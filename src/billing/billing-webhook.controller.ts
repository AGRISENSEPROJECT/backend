import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BillingService } from './billing.service';

@ApiTags('Billing')
@Controller('billing/webhooks')
export class BillingWebhookController {
  constructor(private readonly billingService: BillingService) {}

  @Post(':provider')
  @ApiOperation({
    summary: 'Payment provider webhook',
    description:
      'No JWT. Verifies Flutterwave signature (verif-hash). On success activates Pro and records PaymentTransaction. Idempotent by providerRef. In sandbox/dev without FLUTTERWAVE_SECRET_HASH, signature checks are relaxed.',
  })
  handleWebhook(
    @Param('provider') provider: string,
    @Headers('verif-hash') verifHash: string | undefined,
    @Headers('flutterwave-signature') flutterwaveSignature: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    if (provider !== 'flutterwave') {
      return { received: true, ignored: true, reason: `Unsupported provider: ${provider}` };
    }
    return this.billingService.handleFlutterwaveWebhook(
      verifHash || flutterwaveSignature,
      body,
    );
  }
}
