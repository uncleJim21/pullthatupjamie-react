// services/lightning-api.ts
import type { Invoice } from '../types/invoice.ts';

interface InvoicePoolResponse {
  invoices: Invoice[];
}

export async function fetchInvoicePool(): Promise<Invoice[]> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/invoice-pool`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Fix: destructure invoices from the response
    const { invoices } = await response.json() as InvoicePoolResponse;
    return invoices;  // Return just the invoices array
  } catch (error) {
    console.error('Failed to fetch invoice pool:', error);
    throw error;
  }
}