import { requestProvider } from '@getalby/bitcoin-connect';
import { printLog } from '../constants/constants.ts';

interface WebLNProvider {
  sendPayment: (paymentRequest: string) => Promise<{ preimage: string }>;
}

class LightningService {
  private static provider: WebLNProvider | null = null;

  static async initialize() {
    try {
      printLog("Initializing Lightning provider...");
      this.provider = await requestProvider();
      printLog(`Lightning provider initialized:${this.provider}`);
      return true;
    } catch (error) {
      console.error("Failed to initialize Lightning provider:", error);
      return false;
    }
  }

  static async payInvoice(bolt11: string): Promise<string> {
    try {
      if (!this.provider) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize Lightning provider');
        }
      }

      printLog(`Attempting payment for invoice:${bolt11}`);
      const result = await this.provider!.sendPayment(bolt11);
      printLog(`Payment successful! Preimage:${result.preimage}`);
      return result.preimage;
    } catch (error) {
      console.error("Payment failed:", error);
      throw error;
    }
  }

  static isInitialized(): boolean {
    return this.provider !== null;
  }

  static reset() {
    this.provider = null;
  }
}

export default LightningService;