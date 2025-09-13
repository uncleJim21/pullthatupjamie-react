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
 */
export const relayPool = [
  "wss://relay.primal.net",
  "wss://relay.damus.io", 
  "wss://nos.lol"
];
