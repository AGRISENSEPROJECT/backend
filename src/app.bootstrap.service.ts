import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from './common/enums/user-role.enum';
import { UserStatus } from './common/enums/user-status.enum';

@Injectable()
export class AppBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppBootstrapService.name);
  private hasRun = false;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    if (this.hasRun) {
      return;
    }
    this.hasRun = true;

    await this.ensureBaseSchema();
    await this.runPendingSqlMigrations();
    await this.seedAdminUser();
  }

  private async ensureBaseSchema() {
    const usersTable = await this.dataSource.query(
      `SELECT to_regclass('public.users') AS table_name`,
    );
    const farmsTable = await this.dataSource.query(
      `SELECT to_regclass('public.farms') AS table_name`,
    );
    const hasBaseSchema = Boolean(usersTable?.[0]?.table_name && farmsTable?.[0]?.table_name);

    if (hasBaseSchema) {
      return;
    }

    this.logger.warn('Base schema missing; running TypeORM synchronize once to bootstrap tables.');
    await this.dataSource.synchronize();
  }

  private async runPendingSqlMigrations() {
    if (this.configService.get<string>('NODE_ENV') === 'development') {
      this.logger.log('Skipping SQL migrations in development; relying on TypeORM schema sync.');
      return;
    }

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    const migrationDir = path.join(process.cwd(), 'migrations');
    if (!fs.existsSync(migrationDir)) {
      this.logger.warn('Migrations directory not found; skipping SQL migrations.');
      return;
    }

    const migrationFiles = fs
      .readdirSync(migrationDir)
      .filter((filename) => filename.endsWith('.sql'))
      .filter((filename) => !filename.toLowerCase().includes('rollback'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    for (const filename of migrationFiles) {
      const existing = await this.dataSource.query(
        `SELECT 1 FROM schema_migrations WHERE filename = $1 LIMIT 1`,
        [filename],
      );
      if (existing.length > 0) {
        continue;
      }

      const migrationPath = path.join(migrationDir, filename);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      this.logger.log(`Running SQL migration: ${filename}`);
      await this.dataSource.query(sql);
      await this.dataSource.query(
        `INSERT INTO schema_migrations (filename) VALUES ($1)`,
        [filename],
      );
    }
  }

  private async seedAdminUser() {
    const userRepository = this.dataSource.getRepository(User);
    const adminEmail =
      this.configService.get<string>('SEED_ADMIN_EMAIL') ?? 'nibishaka.dev@gmail.com';
    const adminPassword = this.configService.get<string>('SEED_ADMIN_PASSWORD');
    const firstName = this.configService.get<string>('SEED_ADMIN_FIRST_NAME') ?? 'Nibishaka';
    const lastName = this.configService.get<string>('SEED_ADMIN_LAST_NAME') ?? 'Admin';

    const existing = await userRepository.findOne({ where: { email: adminEmail } });

    if (!adminPassword && !existing) {
      this.logger.warn(
        `SEED_ADMIN_PASSWORD is not set; skipping admin seed for ${adminEmail}.`,
      );
      return;
    }

    const hashedPassword = adminPassword
      ? await bcrypt.hash(adminPassword, 12)
      : null;

    if (!existing) {
      const user = userRepository.create({
        email: adminEmail,
        password: hashedPassword!,
        firstName,
        lastName,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
        onboardingCompleted: true,
        onboardingStep: 3,
      });
      await userRepository.save(user);
      this.logger.log(`Seeded admin user: ${adminEmail}`);
      return;
    }

    let changed = false;
    if (existing.role !== UserRole.ADMIN) {
      existing.role = UserRole.ADMIN;
      changed = true;
    }
    if (existing.status !== UserStatus.ACTIVE) {
      existing.status = UserStatus.ACTIVE;
      changed = true;
    }
    if (!existing.isEmailVerified) {
      existing.isEmailVerified = true;
      changed = true;
    }
    if (!existing.onboardingCompleted || existing.onboardingStep < 3) {
      existing.onboardingCompleted = true;
      existing.onboardingStep = 3;
      changed = true;
    }
    if (!existing.password && hashedPassword) {
      existing.password = hashedPassword;
      changed = true;
    }

    if (changed) {
      await userRepository.save(existing);
      this.logger.log(`Updated seeded admin user: ${adminEmail}`);
    }
  }
}
