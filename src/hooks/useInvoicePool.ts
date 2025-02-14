import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchInvoicePool } from '../services/lightning-api.ts';
import type { Invoice } from '../types/invoice';
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

export function useInvoicePool() {
  const [invoicePool, setInvoicePool] = useState<Invoice[]>(() => {
    try {
      const stored = localStorage.getItem('invoice_pool');
      if (stored) {
        const parsed = JSON.parse(stored) as Invoice[];
        return parsed.filter(
          (inv) => !inv.usedAt && !isInvoiceExpired(inv.pr)
        );
      }
    } catch (err) {
      console.error('Error loading invoice pool:', err);
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetchInProgress = useRef(false);
  const cleanupIntervalMs = 30000;

  useEffect(() => {
    localStorage.setItem('invoice_pool', JSON.stringify(invoicePool));
  }, [invoicePool]);

  const refreshPool = useCallback(async () => {
    if (fetchInProgress.current) {
      printLog('Fetch already in progress, skipping...');
      return;
    }
    const validInvoices = invoicePool.filter(
      inv => !inv.usedAt && !inv.failed && !isInvoiceExpired(inv.pr)
    );
    if (validInvoices.length >= 3) {
      return;
    }
      try {
        fetchInProgress.current = true;
        setIsLoading(true);
  
        printLog('Fetching more invoices...');
        const newInvoices = await fetchInvoicePool();
  
        setInvoicePool((current) => {
          const validCurrent = current.filter(
            (inv) => !inv.usedAt && !inv.failed && !isInvoiceExpired(inv.pr)
          );
          const mergedInvoices = [...validCurrent, ...newInvoices];
  
          // Enforce constraints
          const unpaidInvoices = mergedInvoices.filter((inv) => !inv.paid);
          const paidInvoices = mergedInvoices.filter((inv) => inv.paid && !inv.usedAt);
  
          const newPool = [
            ...paidInvoices.slice(0, 1), // Ensure one paid invoice
            ...unpaidInvoices.slice(0, 1), // Ensure one unpaid invoice
            ...unpaidInvoices.slice(1, 2), // One extra unpaid invoice if available
          ];
  
          return newPool;
        });
      } catch (err) {
        console.error('Failed to refresh invoice pool:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
        fetchInProgress.current = false;
      }
  }, [invoicePool]);
  

  const markInvoiceUsed = useCallback((paymentHash: string) => {
    setInvoicePool((current) =>
      current.filter((inv) => inv.paymentHash !== paymentHash && !isInvoiceExpired(inv.pr))
    );
  }, []);

  const markInvoicePaid = useCallback((paymentHash: string, preimage: string) => {
    setInvoicePool((current) =>
      current
        .map((inv) =>
          inv.paymentHash === paymentHash ? { ...inv, paid: true, preimage } : inv
        )
        .filter((inv) => !isInvoiceExpired(inv.pr))
    );
  }, []);

  const getNextUnpaidInvoice = useCallback(() => {
    const validInvoices = invoicePool.filter(
      (inv) => !inv.paid && !inv.failed && !isInvoiceExpired(inv.pr)
    );
    return validInvoices[0];
  }, [invoicePool]);
  

  const getNextPaidInvoice = useCallback(() => {
    const validInvoices = invoicePool.filter(
      (inv) => inv.paid && !inv.usedAt && !isInvoiceExpired(inv.pr)
    );
    return validInvoices[0];
  }, [invoicePool]);

  // Ensure pool constraints are met on mount and when invoices change
  useEffect(() => {
    if(localStorage.getItem('bc:config')){
      refreshPool();
    }
  }, [invoicePool, refreshPool]);

  const markInvoiceFailed = useCallback((paymentHash: string) => {
    setInvoicePool((current) =>
      current.map((inv) =>
        inv.paymentHash === paymentHash ? { ...inv, failed: true } : inv
      )
    );
  }, []);

  const clearPool = useCallback(() => {
    localStorage.removeItem('invoice_pool');
    setInvoicePool([]);
  }, []);

  const cleanupExpiredInvoices = useCallback(async () => {
    printLog('cleanupExpiredInvoices...')
    if (!localStorage.getItem('bc:config')) return false;
  
    const expiredInvoices = invoicePool.filter(inv => isInvoiceExpired(inv.pr));
    
    if (expiredInvoices.length > 0) {
      printLog(`Found ${expiredInvoices.length} expired invoices`);
      setInvoicePool(current => current.filter(inv => !isInvoiceExpired(inv.pr)));
      await refreshPool();
      return true;
    }
    return false;
  }, [invoicePool, refreshPool]);

  useEffect(() => {
    const interval = setInterval(cleanupExpiredInvoices, cleanupIntervalMs);
    return () => clearInterval(interval);
  }, [cleanupExpiredInvoices]);
  

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
    clearPool,
    cleanupExpiredInvoices
  };
}
