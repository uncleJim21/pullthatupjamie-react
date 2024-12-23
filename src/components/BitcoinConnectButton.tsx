

import React, { useEffect, useState } from 'react';
import LightningService from '../services/lightning.ts';

interface WebLNProvider {
  sendPayment: (paymentRequest: string) => Promise<{ preimage: string }>;
}

interface BitcoinConnectButtonProps {
  onConnect?: () => void;
}

function BitcoinConnectButton({ onConnect }: BitcoinConnectButtonProps) {
  const [BitcoinConnect, setBitcoinConnect] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
    const loadBitcoinConnect = async () => {
      try {
        const bitcoinModule = await import('@getalby/bitcoin-connect-react');
        bitcoinModule.init({
          appName: 'Pull That Up Jamie',
          showBalance: true,
        });
        setBitcoinConnect(bitcoinModule);
      } catch (err) {
        console.error('Failed to load Bitcoin Connect:', err);
        setError('Failed to initialize Bitcoin Connect');
      }
    };

    loadBitcoinConnect();
  }, [isClient]);

  const handleConnect = async (provider: WebLNProvider) => {
    setIsConnecting(true);
    setError(null);

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), 30000);
      });

      await Promise.race([LightningService.initialize(), timeoutPromise]);
      if (onConnect) onConnect();
    } catch (err) {
      console.error('Connection failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to wallet');
      LightningService.reset();
    } finally {
      setIsConnecting(false);
    }
  };

  if (!isClient || !BitcoinConnect) return null;

  return (
    <div className="flex gap-2">
      <BitcoinConnect.Button onConnected={handleConnect} />
      {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
    </div>
  );
}

// Still keep the dynamic import wrapper
export default function DynamicBitcoinConnectButton(props: BitcoinConnectButtonProps) {
  return <BitcoinConnectButton {...props} />;
}