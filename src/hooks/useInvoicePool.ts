import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchInvoicePool } from '../services/lightning-api.ts';
import type { Invoice } from '../types/invoice.ts';
import { printLog } from '../constants/constants.ts';
import bolt11 from 'bolt11';

function getInvoiceExpiry(pr: string): number {
  try {
    const decoded = bolt11.decode(pr);
    const expiryTag = decoded.tags.find(tag => tag.tagName === 'expire_time');
    const expirySeconds = expiryTag ? Number(expiryTag.data) || 3600 : 3600;
    const timestamp = Number(decoded.timestamp);
    return (timestamp + expirySeconds) * 1000;
  } catch (err) {
    console.error('Error decoding invoice:', err);
    return Date.now() + 3600000;
  }
}

function isInvoiceExpired(pr: string): boolean {
  const expiryTime = getInvoiceExpiry(pr);
  return Date.now() > expiryTime;
}

interface PoolState {
  paidCount: number;
  unpaidCount: number;
  totalCount: number;
}

export function useInvoicePool() {
  const [invoicePool, setInvoicePool] = useState<Invoice[]>(() => {
    try {
      const stored = localStorage.getItem('invoice_pool');
      if (stored) {
        const parsed = JSON.parse(stored) as Invoice[];
        return parsed.filter(inv => !inv.usedAt && !isInvoiceExpired(inv.pr));
      }
    } catch (err) {
      console.error('Error loading invoice pool:', err);
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const fetchInProgress = useRef(false);
  const lastPoolUpdate = useRef<number>(Date.now());
  const poolUpdateDebounce = 1000; // 1 second debounce

  // Keep track of pool state
  const getPoolState = useCallback((): PoolState => {
    const validInvoices = invoicePool.filter(inv => !isInvoiceExpired(inv.pr));
    return {
      paidCount: validInvoices.filter(inv => inv.paid && !inv.usedAt).length,
      unpaidCount: validInvoices.filter(inv => !inv.paid && !inv.failed).length,
      totalCount: validInvoices.length
    };
  }, [invoicePool]);

  // Debounced pool refresh check
  const shouldRefreshPool = useCallback(() => {
    const now = Date.now();
    const state = getPoolState();
    
    // Check if enough time has passed since last update
    if (now - lastPoolUpdate.current < poolUpdateDebounce) {
      return false;
    }

    // Check if we need more invoices
    const needsRefresh = state.paidCount < 1 || state.unpaidCount < 1 || state.totalCount < 2;
    
    return needsRefresh && !fetchInProgress.current && !paymentInProgress;
  }, [getPoolState, paymentInProgress]);

  // Ensure pool is persisted
  useEffect(() => {
    localStorage.setItem('invoice_pool', JSON.stringify(invoicePool));
  }, [invoicePool]);

  const refreshPool = useCallback(async () => {
    if (fetchInProgress.current || !shouldRefreshPool()) {
      return;
    }

    try {
      fetchInProgress.current = true;
      setIsLoading(true);
      printLog('Fetching more invoices...');

      const newInvoices = await fetchInvoicePool();
      
      setInvoicePool(current => {
        // Filter out expired and used invoices
        const validCurrent = current.filter(
          inv => !inv.usedAt && !inv.failed && !isInvoiceExpired(inv.pr)
        );

        // Merge and deduplicate invoices by payment hash
        const mergedInvoices = [...validCurrent];
        for (const newInv of newInvoices) {
          if (!mergedInvoices.some(inv => inv.paymentHash === newInv.paymentHash)) {
            mergedInvoices.push(newInv);
          }
        }

        // Maintain pool constraints
        const paidInvoices = mergedInvoices.filter(inv => inv.paid && !inv.usedAt);
        const unpaidInvoices = mergedInvoices.filter(inv => !inv.paid);

        return [
          ...paidInvoices.slice(0, 1),     // Keep one paid invoice
          ...unpaidInvoices.slice(0, 2)     // Keep up to two unpaid invoices
        ];
      });

      lastPoolUpdate.current = Date.now();
    } catch (err) {
      console.error('Failed to refresh invoice pool:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
      fetchInProgress.current = false;
    }
  }, [shouldRefreshPool]);

  const markInvoiceUsed = useCallback((paymentHash: string) => {
    setInvoicePool(current => {
      const updated = current.filter(inv => 
        inv.paymentHash !== paymentHash && !isInvoiceExpired(inv.pr)
      );
      return updated;
    });
  }, []);

  const markInvoicePaid = useCallback((paymentHash: string, preimage: string) => {
    setInvoicePool(current => {
      const updated = current
        .map(inv => inv.paymentHash === paymentHash ? { ...inv, paid: true, preimage } : inv)
        .filter(inv => !isInvoiceExpired(inv.pr));
      return updated;
    });
  }, []);

  const markInvoiceFailed = useCallback((paymentHash: string) => {
    setInvoicePool(current => 
      current.map(inv => 
        inv.paymentHash === paymentHash ? { ...inv, failed: true } : inv
      )
    );
  }, []);

  const getNextUnpaidInvoice = useCallback(() => {
    if (paymentInProgress) {
      return null;
    }
    
    const validInvoices = invoicePool.filter(
      inv => !inv.paid && !inv.failed && !isInvoiceExpired(inv.pr)
    );
    return validInvoices[0] || null;
  }, [invoicePool, paymentInProgress]);

  const getNextPaidInvoice = useCallback(() => {
    const validInvoices = invoicePool.filter(
      inv => inv.paid && !inv.usedAt && !isInvoiceExpired(inv.pr)
    );
    return validInvoices[0] || null;
  }, [invoicePool]);

  const cleanupExpiredInvoices = useCallback(async () => {
    if (!localStorage.getItem('bc:config')) return false;

    const hadExpired = invoicePool.some(inv => isInvoiceExpired(inv.pr));
    
    if (hadExpired) {
      setInvoicePool(current => current.filter(inv => !isInvoiceExpired(inv.pr)));
      if (shouldRefreshPool()) {
        await refreshPool();
        return true;
      }
    }
    return false;
  }, [invoicePool, refreshPool, shouldRefreshPool]);

  // Periodic cleanup and refresh
  useEffect(() => {
    const interval = setInterval(cleanupExpiredInvoices, 30000);
    return () => clearInterval(interval);
  }, [cleanupExpiredInvoices]);

  // Monitor pool state and refresh when needed
  useEffect(() => {
    if (localStorage.getItem('bc:config') && shouldRefreshPool()) {
      refreshPool();
    }
  }, [refreshPool, shouldRefreshPool]);

  return {
    invoicePool,
    isLoading,
    error,
    refreshPool,
    markInvoicePaid,
    markInvoiceUsed,
    markInvoiceFailed,
    getNextUnpaidInvoice,
    getNextPaidInvoice,
    getPoolState,
    cleanupExpiredInvoices,
    setPaymentInProgress,
    paymentInProgress
  };
}