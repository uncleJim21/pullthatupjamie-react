// types/nostr.ts
// NIP-07 browser extension types

export interface NostrEvent {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
  pubkey?: string;
  id?: string;
  sig?: string;
}

export interface SignedNostrEvent extends NostrEvent {
  pubkey: string;
  id: string;
  sig: string;
}

export interface NIP07Nostr {
  getPublicKey(): Promise<string>;
  signEvent(event: NostrEvent): Promise<SignedNostrEvent>;
  getRelays?(): Promise<{ [url: string]: { read: boolean; write: boolean } }>;
  nip04?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
}

// Extend Window interface
declare global {
  interface Window {
    nostr?: NIP07Nostr;
  }
}

export {};
