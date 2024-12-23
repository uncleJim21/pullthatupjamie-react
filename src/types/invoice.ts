export interface Invoice {
    status: string;
    successAction: any;
    verify: string;
    routes: any[];
    pr: string;
    paymentHash: string;
    preimage?: string;
    paid?: boolean;
    failed?:boolean;
    usedAt?: number;  // Timestamp when the invoice was used for a request
  }