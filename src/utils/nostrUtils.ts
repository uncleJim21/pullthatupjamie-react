// Shared Nostr utilities for consistent URL generation across the app

// Bech32 helper function with proper checksum calculation
const encodeBech32 = (prefix: string, data: string): string => {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

  const polymod = (values: number[]): number => {
    let chk = 1;
    for (let value of values) {
      const top = chk >> 25;
      chk = (chk & 0x1ffffff) << 5 ^ value;
      for (let i = 0; i < 5; i++) {
        if ((top >> i) & 1) {
          chk ^= GENERATOR[i];
        }
      }
    }
    return chk;
  };

  const hrpExpand = (hrp: string): number[] => {
    const result: number[] = [];
    for (let i = 0; i < hrp.length; i++) {
      result.push(hrp.charCodeAt(i) >> 5);
    }
    result.push(0);
    for (let i = 0; i < hrp.length; i++) {
      result.push(hrp.charCodeAt(i) & 31);
    }
    return result;
  };

  const hexToBytes = (hex: string): number[] => {
    const result: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      result.push(parseInt(hex.slice(i, i + 2), 16));
    }
    return result;
  };

  const convertBits = (data: number[], fromBits: number, toBits: number, pad: boolean): number[] => {
    let acc = 0;
    let bits = 0;
    const result: number[] = [];
    const maxv = (1 << toBits) - 1;

    for (const value of data) {
      if (value < 0 || (value >> fromBits) !== 0) {
        throw new Error('Invalid value');
      }
      acc = (acc << fromBits) | value;
      bits += fromBits;
      while (bits >= toBits) {
        bits -= toBits;
        result.push((acc >> bits) & maxv);
      }
    }

    if (pad) {
      if (bits > 0) {
        result.push((acc << (toBits - bits)) & maxv);
      }
    } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv) !== 0) {
      throw new Error('Invalid padding');
    }

    return result;
  };

  // Convert event ID to bytes
  const eventIdBytes = hexToBytes(data);

  // Create TLV data
  const tlv = [0, 32, ...eventIdBytes]; // type 0, length 32, followed by event ID

  // Convert to 5-bit array
  const words = convertBits(tlv, 8, 5, true);

  // Calculate checksum
  const hrpExpanded = hrpExpand(prefix);
  const values = [...hrpExpanded, ...words];
  const polymodValue = polymod([...values, 0, 0, 0, 0, 0, 0]) ^ 1;
  const checksumWords: number[] = [];
  for (let i = 0; i < 6; i++) {
    checksumWords.push((polymodValue >> 5 * (5 - i)) & 31);
  }

  // Combine everything
  return prefix + '1' + 
         words.map(i => CHARSET.charAt(i)).join('') + 
         checksumWords.map(i => CHARSET.charAt(i)).join('');
};

/**
 * Generate a proper Primal URL from a Nostr event ID
 * @param eventId - The hex event ID from the signed Nostr event
 * @returns Properly formatted Primal URL with bech32 encoding
 */
export const generatePrimalUrl = (eventId: string): string => {
  const bech32EventId = encodeBech32('nevent', eventId);
  return `https://primal.net/e/${bech32EventId}`;
};

/**
 * Standard relay pool for Nostr events
 *
 * Note: We keep this centralized so direct-publish and scheduled-posting use the same defaults.
 */
const normalizeRelayUrl = (url: string): string | null => {
  const trimmed = (url || '').trim();
  if (!trimmed) return null;
  // Only allow ws/wss relay URLs
  if (!(trimmed.startsWith('wss://') || trimmed.startsWith('ws://'))) return null;
  // Normalize: remove trailing slash
  return trimmed.replace(/\/+$/, '');
};

// Expanded relay defaults for broader publishing reach (normalized, deduped)
const DEFAULT_RELAYS_RAW = [
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nos.lol",

  // Expanded defaults
  "wss://eden.nostr.land",
  "wss://atlas.nostr.land",
  "wss://cyberspace.nostr1.com",
  "wss://nostr.lopp.social",
  "wss://nostr.czas.plus",
  "wss://premium.primal.net",
  "wss://relay.artio.inf.unibe.ch",
  "wss://relay-rpi.edufeed.org",
  "wss://relay.nosto.re",
  "wss://nostr.oxtr.dev",
  "wss://njump.me",
  "wss://espelho.girino.org",

  // Legacy/common relays
  "wss://relay.mostr.pub",
  "wss://nostr.land",
  "wss://purplerelay.com",
  "wss://relay.snort.social",
];

export const relayPool = Array.from(
  new Set(DEFAULT_RELAYS_RAW.map(normalizeRelayUrl).filter(Boolean) as string[])
);

export interface RelayPublishResult {
  success: boolean;
  successCount: number;
  totalRelays: number;
  eventId: string;
  primalUrl: string;
}

/**
 * Build relay-hint "r" tags for a Nostr event (include before signing).
 */
export const buildRelayHintTags = (relays: string[] = relayPool, limit: number = 5): string[][] =>
  relays.slice(0, Math.max(0, limit)).map((r) => ["r", r]);

/**
 * Publish a signed Nostr event to the relay pool via raw WebSockets.
 *
 * Resolves as soon as `minSuccesses` relays confirm with OK, or after all
 * relays have been attempted. No React state — safe to call from anywhere.
 */
export const publishToRelays = (
  signedEvent: any,
  relays: string[] = relayPool,
  { minSuccesses = 3, perRelayTimeoutMs = 10_000 } = {}
): Promise<RelayPublishResult> => {
  return new Promise((resolve) => {
    let successCount = 0;
    let settled = 0;
    let resolved = false;
    const total = relays.length;

    const finish = (early: boolean) => {
      if (resolved) return;
      resolved = true;
      resolve({
        success: early || successCount >= minSuccesses,
        successCount,
        totalRelays: total,
        eventId: signedEvent.id,
        primalUrl: generatePrimalUrl(signedEvent.id),
      });
    };

    relays.forEach((relay) => {
      let done = false;
      let ws: WebSocket | null = null;

      const cleanup = () => {
        if (done) return;
        done = true;
        settled++;
        try { ws?.close(); } catch { /* ignore */ }
        if (settled >= total) finish(false);
      };

      const timeout = setTimeout(cleanup, perRelayTimeoutMs);

      try {
        ws = new WebSocket(relay);

        ws.onopen = () => {
          ws!.send(JSON.stringify(["EVENT", signedEvent]));
        };

        ws.onmessage = (msg: MessageEvent) => {
          try {
            const data = JSON.parse(msg.data);
            if (Array.isArray(data) && data[0] === "OK" && data[1] === signedEvent.id) {
              clearTimeout(timeout);
              if (data[2] === true) {
                successCount++;
                if (!resolved && successCount >= minSuccesses) finish(true);
              }
              cleanup();
            }
          } catch { /* ignore parse errors */ }
        };

        ws.onerror = () => { clearTimeout(timeout); cleanup(); };
        ws.onclose = () => { clearTimeout(timeout); cleanup(); };
      } catch {
        clearTimeout(timeout);
        cleanup();
      }
    });
  });
};
