"""Exercise deployment failures without Docker, network access, or production data."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[2] / 'scripts' / 'deploy-api.sh'
FAKE_TOOL = r'''#!/usr/bin/env python3
import json, os, pathlib, sys
state_file = pathlib.Path(os.environ['FAKE_STATE'])
state = json.loads(state_file.read_text())
tool = pathlib.Path(sys.argv[0]).name
args = sys.argv[1:]
state['events'].append([tool, *args])
scenario = os.environ['SCENARIO']
code = 0
output = ''
if tool == 'curl':
    if state['current'] == 'candidate' and scenario == 'routing_failure':
        code = 22
    else:
        output = '{"status":"ok"}'
elif args[:2] == ['image', 'tag']:
    if args[3] == 'agrisense-api:rollback':
        state['saved_image'] = args[2]
    elif args[3] == 'agrisense-api:latest':
        state['tag'] = 'previous'
elif args[0] == 'inspect':
    if '.Image' in args[2]:
        output = 'sha256:previous'
    elif state['current'] == 'candidate' and scenario == 'health_failure':
        output = 'unhealthy'
    else:
        output = 'healthy'
elif args[0] == 'compose':
    command = args[3:]
    if command[:2] == ['ps', '-q']:
        output = 'api-container'
    elif command[0] == 'build':
        code = 1 if scenario == 'build_failure' else 0
        if code == 0:
            state['tag'] = 'candidate'
    elif command[0] == 'up':
        if state['tag'] == 'previous':
            state['current'] = 'previous'
            if scenario == 'rollback_failure':
                code = 1
        else:
            state['current'] = 'candidate'
            if scenario in ('start_failure', 'rollback_failure'):
                code = 1
    elif command[0] == 'exec':
        code = 0
    else:
        raise SystemExit('Unexpected compose command: ' + repr(command))
else:
    raise SystemExit('Unexpected command: ' + repr(args))
state_file.write_text(json.dumps(state))
if output:
    print(output)
sys.exit(code)
'''


class DeploymentRecoveryTests(unittest.TestCase):
    def deploy(self, scenario):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'bin').mkdir()
            (root / 'scripts').mkdir()
            (root / 'docker-compose.yml').write_text('services: {}\n')
            (root / 'scripts' / 'backup-host.sh').write_text(
                '#!/bin/bash\n'
                'if [[ "$SCENARIO" == backup_failure ]]; then exit 1; fi\n'
                'touch "$DEPLOY_DIR/backup-completed"\n'
            )
            for name in ['docker', 'curl']:
                tool = root / 'bin' / name
                tool.write_text(FAKE_TOOL)
                tool.chmod(0o755)
            state_file = root / 'state.json'
            state_file.write_text(json.dumps({'current': 'previous', 'tag': 'previous', 'events': []}))
            env = {
                **os.environ,
                'PATH': str(root / 'bin') + os.pathsep + os.environ['PATH'],
                'DEPLOY_DIR': str(root),
                'DEPLOY_LOCK': str(root / 'lock'),
                'HEALTH_ATTEMPTS': '2',
                'HEALTH_INTERVAL': '0',
                'SCENARIO': scenario,
                'FAKE_STATE': str(state_file),
            }
            result = subprocess.run(
                ['bash', str(SCRIPT), 'test-release'],
                env=env, text=True, capture_output=True, timeout=10,
            )
            state = json.loads(state_file.read_text())
            state['backup_completed'] = (root / 'backup-completed').exists()
            self.assertEqual(list(root.glob('.api-release.*.yml')), [])
            return result, state

    def test_success_checks_container_and_https(self):
        result, state = self.deploy('success')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(state['current'], 'candidate')
        self.assertEqual(state['saved_image'], 'sha256:previous')
        self.assertTrue(state['backup_completed'])
        curl_calls = [e for e in state['events'] if e[0] == 'curl']
        self.assertEqual(curl_calls[0][-1], 'https://api.agrisense.rw/api/health')
        self.assertNotIn('--insecure', curl_calls[0])

    def test_build_failure_keeps_old_container_running(self):
        result, state = self.deploy('build_failure')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(state['current'], 'previous')
        self.assertEqual(state['tag'], 'previous')
        self.assertFalse(any('up' in e for e in state['events']))

    def test_backup_failure_prevents_replacement(self):
        result, state = self.deploy('backup_failure')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(state['current'], 'previous')
        self.assertEqual(state['tag'], 'previous')
        self.assertFalse(any('up' in e for e in state['events']))

    def test_failed_start_restores_previous_image(self):
        result, state = self.deploy('start_failure')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(state['current'], 'previous')
        self.assertIn('Previous API version restored', result.stderr)

    def test_unhealthy_candidate_restores_previous_image(self):
        result, state = self.deploy('health_failure')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(state['current'], 'previous')
        self.assertIn('Previous API version restored', result.stderr)

    def test_failed_https_check_restores_previous_image(self):
        result, state = self.deploy('routing_failure')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(state['current'], 'previous')
        self.assertIn('Previous API version restored', result.stderr)

    def test_failed_rollback_remains_failed_and_reports_manual_recovery(self):
        result, state = self.deploy('rollback_failure')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Manual recovery is required', result.stderr)
        self.assertNotIn('Previous API version restored', result.stderr)


if __name__ == '__main__':
    unittest.main()
