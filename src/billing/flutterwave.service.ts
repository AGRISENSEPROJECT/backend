import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { BillingCycle, PaymentMethodType } from './billing.enums';

export type FlutterwaveChargeResult = {
  provider: 'flutterwave';
  mode: 'ussd_push' | 'redirect' | 'instruction' | 'sandbox';
  providerRef: string;
  redirectUrl?: string;
  message: string;
  sandbox?: boolean;
};

@Injectable()
export class FlutterwaveService {
  private readonly logger = new Logger(FlutterwaveService.name);
  private readonly client: AxiosInstance | null;
  private readonly secretKey: string;
  private readonly publicKey: string;
  private readonly secretHash: string;
  private readonly sandbox: boolean;

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('FLUTTERWAVE_SECRET_KEY') || '';
    this.publicKey = this.configService.get<string>('FLUTTERWAVE_PUBLIC_KEY') || '';
    this.secretHash =
      this.configService.get<string>('FLUTTERWAVE_SECRET_HASH') ||
      this.configService.get<string>('FLUTTERWAVE_WEBHOOK_HASH') ||
      '';
    this.sandbox =
      this.configService.get('FLUTTERWAVE_SANDBOX') === 'true' ||
      this.configService.get('NODE_ENV') === 'development' ||
      !this.secretKey;

    if (this.secretKey) {
      this.client = axios.create({
        baseURL: 'https://api.flutterwave.com/v3',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });
    } else {
      this.client = null;
      this.logger.warn(
        'FLUTTERWAVE_SECRET_KEY missing — billing checkout runs in sandbox mode',
      );
    }
  }

  isSandbox() {
    return this.sandbox || !this.client;
  }

  normalizeRwandaPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('250')) return digits;
    if (digits.startsWith('0')) return `250${digits.slice(1)}`;
    return digits;
  }

  maskPhone(phone: string): string {
    const normalized = this.normalizeRwandaPhone(phone);
    if (normalized.length < 8) return 'MoMo · ****';
    return `0${normalized.slice(3, 5)}***${normalized.slice(-4)}`;
  }

  buildPaymentLabel(method: PaymentMethodType, phone?: string): string {
    if (method === PaymentMethodType.CARD) return 'Card ···· ****';
    if (method === PaymentMethodType.MOMO) {
      return `MTN MoMo · ${phone ? this.maskPhone(phone) : '****'}`;
    }
    if (method === PaymentMethodType.AIRTEL) {
      return `Airtel Money · ${phone ? this.maskPhone(phone) : '****'}`;
    }
    if (method === PaymentMethodType.MANUAL) return 'Manual / Admin';
    return 'None';
  }

  verifyWebhookSignature(signatureHeader?: string): boolean {
    if (this.isSandbox() && !this.secretHash) {
      return true;
    }
    if (!this.secretHash) {
      this.logger.warn('FLUTTERWAVE_SECRET_HASH not set — rejecting webhook');
      return false;
    }
    return Boolean(signatureHeader && signatureHeader === this.secretHash);
  }

  async initiateCharge(input: {
    txRef: string;
    amount: number;
    currency: string;
    email: string;
    name: string;
    method: PaymentMethodType;
    phone?: string;
    billingCycle: BillingCycle;
    returnUrl?: string;
  }): Promise<FlutterwaveChargeResult> {
    if (this.isSandbox() || !this.client) {
      return {
        provider: 'flutterwave',
        mode: 'sandbox',
        providerRef: input.txRef,
        message:
          'Sandbox mode: approve this payment via POST /api/billing/webhooks/flutterwave with the same tx_ref, or use the sandbox success simulator.',
        sandbox: true,
      };
    }

    if (input.method === PaymentMethodType.CARD) {
      const payload = {
        tx_ref: input.txRef,
        amount: input.amount,
        currency: input.currency,
        redirect_url: input.returnUrl || `${this.configService.get('FRONTEND_URL')}/app/subscription`,
        customer: {
          email: input.email,
          name: input.name,
          phonenumber: input.phone ? this.normalizeRwandaPhone(input.phone) : undefined,
        },
        customizations: {
          title: 'AgriSense Pro',
          description: `AgriSense Pro (${input.billingCycle})`,
        },
        payment_options: 'card',
      };

      const { data } = await this.client.post('/payments', payload);
      if (data?.status !== 'success' || !data?.data?.link) {
        throw new Error(data?.message || 'Failed to create Flutterwave payment link');
      }

      return {
        provider: 'flutterwave',
        mode: 'redirect',
        providerRef: input.txRef,
        redirectUrl: data.data.link,
        message: 'Complete card payment on the secure Flutterwave checkout page',
      };
    }

    const network = input.method === PaymentMethodType.AIRTEL ? 'AIRTEL' : 'MTN';
    if (!input.phone) {
      throw new Error('Phone number is required for mobile money');
    }

    const payload = {
      tx_ref: input.txRef,
      amount: input.amount,
      currency: input.currency,
      email: input.email,
      phone_number: this.normalizeRwandaPhone(input.phone),
      fullname: input.name,
      network,
    };

    const { data } = await this.client.post('/charges?type=mobile_money_rwanda', payload);
    if (data?.status !== 'success') {
      throw new Error(data?.message || 'Failed to initiate mobile money charge');
    }

    return {
      provider: 'flutterwave',
      mode: 'ussd_push',
      providerRef: data?.data?.flw_ref || input.txRef,
      message:
        data?.meta?.authorization?.mode === 'redirect'
          ? 'Follow the payment instructions on your phone'
          : 'Approve the MoMo / Airtel Money prompt on your phone',
    };
  }

  async verifyTransaction(txRef: string): Promise<{
    success: boolean;
    amount?: number;
    currency?: string;
    flwRef?: string;
    raw?: Record<string, unknown>;
    failureReason?: string;
  }> {
    if (this.isSandbox() || !this.client) {
      return {
        success: true,
        amount: undefined,
        currency: 'RWF',
        flwRef: txRef,
        raw: { sandbox: true, tx_ref: txRef },
      };
    }

    try {
      const { data } = await this.client.get(`/transactions/verify_by_reference`, {
        params: { tx_ref: txRef },
      });
      const status = data?.data?.status;
      const success = data?.status === 'success' && status === 'successful';
      return {
        success,
        amount: data?.data?.amount,
        currency: data?.data?.currency,
        flwRef: data?.data?.flw_ref,
        raw: data,
        failureReason: success ? undefined : data?.data?.processor_response || data?.message,
      };
    } catch (error: any) {
      this.logger.error(`Verify failed for ${txRef}: ${error?.message}`);
      return {
        success: false,
        failureReason: error?.response?.data?.message || error?.message || 'Verification failed',
        raw: error?.response?.data,
      };
    }
  }

  createTxRef(prefix = 'ags'): string {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }
}
