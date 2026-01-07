## Construct, Sign, and Publish a Nostr Event with Media (current implementation)

This document snapshots what the app currently does in code, even if parts are non-standard. It covers both flows implemented in `src/components/SocialShareModal.tsx`:

- Scheduling a Nostr post (frontend signs and sends signature details to backend)
- Direct publish to Nostr relays (no scheduling)

Today (explicitly):
- Scheduling flow: event includes media via an `r` tag before signing.
- Direct publish flow: event uses `tags: []` (no `r` tag); media URL is appended to `content` (non-standard).

### Prerequisites
- With NIP-07 (browser extension): none
- With code-based signing:
  - `npm i nostr-tools @noble/hashes @noble/secp256k1`

### 1) Construct the event object (with media)

There are two constructions in the code today:

- Scheduling flow: Adds media via an `r` tag (NIP-01 style)
- Direct publish flow: Does not use `r` tag; media URL is appended to `content` (non-standard)

```ts
type UnsignedEvent = {
  kind: 1;
  created_at: number;       // seconds since epoch
  content: string;          // your post text
  tags: string[][];
  pubkey?: string;          // hex (set only if signing without NIP-07)
};

// Example inputs
const text = "Ever thought about the art of persistence hunting?";
const mediaUrl = "https://cdn.example.com/clip.mp4";
const createdAt = Math.floor(Date.now() / 1000); // or a predetermined timestamp you must reuse for signing

// A) Scheduling flow (uses `r` tag) — this is what the code does today when scheduling
const eventToSignForScheduling: UnsignedEvent = {
  kind: 1,
  created_at: createdAt, // Math.floor(Date.now() / 1000) at call-time
  content: /* finalContent = user text + optional signature (no CTA or URL appended) */ text,
  tags: mediaUrl ? [["r", mediaUrl]] : []
};

// B) Direct publish flow (non-standard; NO `r` tag) — this is what the code does today when publishing immediately
// mediaUrl is appended into the text content itself via buildFinalContent(..., platform='nostr')
const eventToSignForDirectPublish: UnsignedEvent = {
  kind: 1,
  created_at: createdAt,
  content: `${text}${signature ? `\n\n${signature}` : ''}${mediaUrl ? `\n\n${mediaUrl}` : ''}\n\nShared via https://pullthatupjamie.ai`,
  tags: [] // no media tag is added in this path
};
```

### 2) Canonical serialization string (NIP-01)
Both flows serialize as: `[0, pubkey, created_at, kind, tags, content]`.

- For NIP-07 signing, the extension supplies `pubkey` and returns the signature; you still serialize using the same fields internally.
- For manual signing, you must provide the hex `pubkey` yourself.

```ts
// Canonical serialization (NIP-01):
// [ 0, <pubkey>, <created_at>, <kind>, <tags>, <content> ]
function serializeEventForHash(
  pubkeyHex: string,
  evt: { kind: number; created_at: number; content: string; tags: string[][] }
): string {
  return JSON.stringify([0, pubkeyHex, evt.created_at, evt.kind, evt.tags, evt.content]);
}
```

Example JSON string for hashing (illustrative):

```json
// A) Scheduling flow (with r tag)
[0,"4535551a40271b059ab92b71e7ab7e8700061a2d91b0d20f313ef82f052eb085",1736200000,1,[["r","https://cdn.example.com/clip.mp4"]],"Ever thought about the art of persistence hunting?"]

// B) Direct publish flow (no r tag; URL embedded in content)
[0,"4535551a40271b059ab92b71e7ab7e8700061a2d91b0d20f313ef82f052eb085",1736200000,1,[],"Ever thought about the art of persistence hunting?\n\nhttps://cdn.example.com/clip.mp4\n\nShared via https://pullthatupjamie.ai"]
```

This exact string (including array order, quotes, and no extra whitespace) is UTF-8 encoded and SHA-256 hashed to produce the event id.

### 3A) Signing with a NIP-07 browser extension (current behavior)
Both flows call `window.nostr.signEvent(evt)` where `evt` is either the scheduling or direct-publish event. The extension supplies `pubkey`, hashes the canonical JSON, and returns `id` and `sig`.

```ts
// Requires a NIP-07 extension (window.nostr)
const signedEvent = await window.nostr.signEvent(eventToSign);
/*
signedEvent looks like:
{
  id: "<64-hex sha256 of serialized event>",
  sig: "<64-hex secp256k1 signature>",
  pubkey: "<hex pubkey>",
  kind: 1,
  created_at: <number>,
  content: "<text>",
  tags: [...]
}
*/

// You must persist/use the timestamp used for signing:
const nostrCreatedAt = signedEvent.created_at; // send this to your backend with the signature
```

### 3B) Manual signing (supported pattern, not used by default)
If signing locally, provide `pubkey`, serialize, hash, and sign. This section shows how, though the app uses NIP-07 by default.

```ts
import { sha256 } from "@noble/hashes/sha256";
import * as secp from "@noble/secp256k1";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { getPublicKey } from "nostr-tools"; // derives pubkey from secret key

// WARNING: Never persist secret keys in localStorage.
// Use secure input/ephemeral memory only.
const nsecHex = "<32-byte secret key in hex>"; // do not include 'nsec1' bech32 here
const pubkeyHex = getPublicKey(hexToBytes(nsecHex)); // hex

// Build the exact serialization string
const serialized = serializeEventForHash(pubkeyHex, eventToSign);

// 1) Hash the UTF-8 bytes of `serialized`
const encoder = new TextEncoder();
const idBytes = sha256(encoder.encode(serialized));
const idHex = bytesToHex(idBytes); // event id

// 2) Sign the hash
const sigBytes = await secp.schnorr.sign(idBytes, hexToBytes(nsecHex));
const sigHex = bytesToHex(sigBytes);

// 3) Final signed event
const signedEvent = {
  id: idHex,
  sig: sigHex,
  pubkey: pubkeyHex,
  kind: eventToSign.kind,
  created_at: eventToSign.created_at,
  content: eventToSign.content,
  tags: eventToSign.tags
};

// Keep and forward `created_at` alongside signature (backend must verify same timestamp)
const nostrCreatedAt = signedEvent.created_at;
```

### 4) Publish to relays (current behavior for direct publish)
For direct publish (not scheduling), the app opens WebSocket connections to relays and sends `["EVENT", signedEvent]`. In this path, the event includes a **small set of `["r", "<relay_url>"]` relay-hint tags** (2–5) to improve cross-client resolution. These are **hints, not receipts** of where the event was actually published. The media URL is still embedded in `content` (non-standard).

```ts
const relays = [
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nos.lol"
];

function publishToRelay(relayUrl: string, event: any): Promise<boolean> {
  return new Promise((resolve) => {
    const ws = new WebSocket(relayUrl);
    ws.onopen = () => {
      const msg = JSON.stringify(["EVENT", event]);
      ws.send(msg);
    };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        // Expect: ["OK", "<event.id>", true|false, "<message>"]
        if (Array.isArray(data) && data[0] === "OK" && data[1] === event.id) {
          resolve(Boolean(data[2]));
          ws.close();
        }
      } catch {
        // ignore parse errors
      }
    };
    ws.onerror = () => resolve(false);
    ws.onclose = () => resolve(false);
  });
}

const results = await Promise.allSettled(relays.map(r => publishToRelay(r, signedEvent)));
const successCount = results.filter(r => r.status === "fulfilled" && r.value === true).length;
// successCount > 0 means at least one relay accepted the event
```

### 5) Payload to backend for scheduled posting (current behavior)
For scheduling, the app first signs locally, then POSTs to backend with signature fields and the exact `created_at` used during signing:

```ts
const payload = {
  platform: "nostr",
  scheduledFor: new Date("2025-08-10T23:55:00.000Z").toISOString(),
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  content: { text, mediaUrl }, // text includes optional user signature; media is in r-tag for the signed event
  platformData: {
    nostrEventId: signedEvent.id,
    nostrSignature: signedEvent.sig,
    nostrPubkey: signedEvent.pubkey,
    nostrCreatedAt: signedEvent.created_at,
    nostrRelays: relays
  }
};
```

The backend re-serializes `[0, pubkey, created_at, kind, tags, content]`, hashes it, and verifies the Schnorr signature against `pubkey`. Make sure `created_at` in your payload is exactly the same one used to sign.

### Security Notes
- Never store private keys in localStorage
- Clear private key from memory after signing
- Prefer NIP-07 browser extensions for key management
- Validate npub1/nsec1 formats before use

### Non-standard note (direct publish flow)
- The direct publish path does NOT add an `r` tag today; instead it embeds the media URL in `content` along with a call-to-action line. While many clients accept this, the NIP-01 style is to include media as a tag. The scheduling flow DOES add the `r` tag today.


