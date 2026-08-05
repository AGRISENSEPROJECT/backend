import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export type FlutterwaveInitInput = {
  txRef: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string | null;
  redirectUrl: string;
  meta?: Record<string, unknown>;
  paymentOptions?: string;
};

export type FlutterwaveInitResult = {
  checkoutUrl: string;
  providerStatus: string;
  raw: Record<string, unknown>;
};

export type FlutterwaveVerifyResult = {
  status: string;
  amount: number;
  currency: string;
  txRef: string;
  transactionId: string | number;
  chargedAmount: number;
  raw: Record<string, unknown>;
};

@Injectable()
export class FlutterwaveService {
  private readonly logger = new Logger(FlutterwaveService.name);
  private readonly client: AxiosInstance | null;
  private readonly secretKey: string | undefined;
  private readonly webhookHash: string | undefined;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('FLW_SECRET_KEY');
    this.webhookHash = this.configService.get<string>('FLW_WEBHOOK_HASH');
    this.enabled = Boolean(this.secretKey);

    this.client = this.enabled
      ? axios.create({
          baseURL: 'https://api.flutterwave.com/v3',
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        })
      : null;
  }

  isConfigured() {
    return this.enabled;
  }

  assertConfigured() {
    if (!this.client || !this.secretKey) {
      throw new ServiceUnavailableException(
        'Flutterwave is not configured. Set FLW_SECRET_KEY in environment.',
      );
    }
  }

  verifyWebhookHash(incomingHash?: string | string[]) {
    if (!this.webhookHash) {
      this.logger.warn(
        'FLW_WEBHOOK_HASH is not set; webhook signature check is skipped',
      );
      return true;
    }

    const hash = Array.isArray(incomingHash) ? incomingHash[0] : incomingHash;
    return Boolean(hash && hash === this.webhookHash);
  }

  async initializePayment(
    input: FlutterwaveInitInput,
  ): Promise<FlutterwaveInitResult> {
    this.assertConfigured();

    try {
      const response = await this.client!.post('/payments', {
        tx_ref: input.txRef,
        amount: input.amount,
        currency: input.currency,
        redirect_url: input.redirectUrl,
        payment_options: input.paymentOptions ?? 'mobilemoney,card,ussd',
        customer: {
          email: input.customerEmail,
          name: input.customerName,
          phonenumber: input.customerPhone ?? undefined,
        },
        customizations: {
          title: 'AgriSense Marketplace',
          description: 'Payment for AgriSense order',
        },
        meta: input.meta ?? {},
      });

      const body = response.data as {
        status?: string;
        message?: string;
        data?: { link?: string };
      };

      if (body.status !== 'success' || !body.data?.link) {
        throw new BadRequestException(
          body.message || 'Failed to initialize Flutterwave payment',
        );
      }

      return {
        checkoutUrl: body.data.link,
        providerStatus: body.status,
        raw: body as unknown as Record<string, unknown>,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message =
          (error.response?.data as { message?: string } | undefined)?.message ||
          error.message;
        this.logger.error(`Flutterwave init failed: ${message}`);
        throw new BadRequestException(
          `Flutterwave payment init failed: ${message}`,
        );
      }
      throw error;
    }
  }

  async verifyTransaction(
    transactionId: string | number,
  ): Promise<FlutterwaveVerifyResult> {
    this.assertConfigured();

    try {
      const response = await this.client!.get(
        `/transactions/${transactionId}/verify`,
      );

      const body = response.data as {
        status?: string;
        message?: string;
        data?: {
          status?: string;
          amount?: number;
          charged_amount?: number;
          currency?: string;
          tx_ref?: string;
          id?: string | number;
        };
      };

      if (body.status !== 'success' || !body.data) {
        throw new BadRequestException(
          body.message || 'Failed to verify Flutterwave transaction',
        );
      }

      return {
        status: body.data.status || 'unknown',
        amount: Number(body.data.amount ?? 0),
        chargedAmount: Number(body.data.charged_amount ?? body.data.amount ?? 0),
        currency: body.data.currency || 'RWF',
        txRef: body.data.tx_ref || '',
        transactionId: body.data.id ?? transactionId,
        raw: body as unknown as Record<string, unknown>,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message =
          (error.response?.data as { message?: string } | undefined)?.message ||
          error.message;
        this.logger.error(`Flutterwave verify failed: ${message}`);
        throw new BadRequestException(
          `Flutterwave verification failed: ${message}`,
        );
      }
      throw error;
    }
  }
}
