import { requestProvider } from '@getalby/bitcoin-connect';
import { API_URL } from "../constants/constants.ts";
import bolt11 from 'bolt11';

interface Invoice {
  pr: string;
  paymentHash: string;
  paid?: boolean;
  preimage?: string;
}

interface WebLNProvider {
  sendPayment: (paymentRequest: string) => Promise<{ preimage: string }>;
}

class LightningService {
  private static provider: WebLNProvider | null = null;
  private static currentInvoice: Invoice | null = null;

  static async initialize() {
    try {
      this.provider = await requestProvider();
      return true;
    } catch (error) {
      console.error("Failed to initialize Lightning provider:", error);
      return false;
    }
  }

  private static isInvoiceExpired(pr: string): boolean {
    try {
      const decoded = bolt11.decode(pr);
      const expiryTag = decoded.tags.find(tag => tag.tagName === 'expire_time');
      const expirySeconds = expiryTag ? Number(expiryTag.data) || 3600 : 3600;
      const timestamp = Number(decoded.timestamp);
      return Date.now() > (timestamp + expirySeconds) * 1000;
    } catch (err) {
      console.error('Error decoding invoice:', err);
      return true;
    }
  }

  private static async fetchNewInvoice(): Promise<Invoice> {
    const response = await fetch(`${API_URL}/invoice-pool`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const { invoices } = await response.json();
    return invoices[0];
  }

  static async getInvoice(): Promise<Invoice> {
    // Try to use cached invoice first
    const cachedInvoice = localStorage.getItem('lightning_invoice');
    if (cachedInvoice) {
      const invoice = JSON.parse(cachedInvoice) as Invoice;
      if (!this.isInvoiceExpired(invoice.pr)) {
        this.currentInvoice = invoice;
        return invoice;
      }
    }

    // Fetch new invoice if needed
    const newInvoice = await this.fetchNewInvoice();
    localStorage.setItem('lightning_invoice', JSON.stringify(newInvoice));
    this.currentInvoice = newInvoice;
    return newInvoice;
  }

  static async handlePayment(): Promise<{ preimage: string, paymentHash: string } | null> {
    if (!this.provider) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize Lightning provider');
      }
    }

    try {
      const invoice = await this.getInvoice();

      // Attempt payment
      const result = await this.provider!.sendPayment(invoice.pr);
      
      // Clear the cached invoice after successful payment
      localStorage.removeItem('lightning_invoice');
      this.currentInvoice = null;

      // Fetch a new invoice in the background for next time
      this.fetchNewInvoice()
        .then(newInvoice => {
          localStorage.setItem('lightning_invoice', JSON.stringify(newInvoice));
        })
        .catch(console.error);

      return {
        preimage: result.preimage,
        paymentHash: invoice.paymentHash
      };
    } catch (error) {
      console.error("Payment failed:", error);
      
      // Clear cached invoice if it's causing issues
      if (error.message?.includes('already been paid')) {
        localStorage.removeItem('lightning_invoice');
        this.currentInvoice = null;
      }
      
      throw error;
    }
  }

  static isInitialized(): boolean {
    return this.provider !== null;
  }

  static reset() {
    this.provider = null;
    this.currentInvoice = null;
    localStorage.removeItem('lightning_invoice');
  }
}

export default LightningService;