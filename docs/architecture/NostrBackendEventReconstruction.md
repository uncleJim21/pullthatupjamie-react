# Nostr Event Reconstruction for Backend Publishing

## Overview
The frontend signs a Nostr event and sends the signature details to the backend. The backend must reconstruct the **exact same event** to publish successfully, as the signature is tied to the specific content and structure.

## Frontend Event Construction (Current Implementation)

### Content Assembly
The frontend builds content in this exact order:
```javascript
const buildFinalContent = (baseContent, mediaUrl, platform) => {
  const signature = getUserSignature(); // from localStorage
  const signaturePart = signature ? `\n\n${signature}` : '';
  const mediaUrlPart = platform === 'nostr' ? `\n\n${mediaUrl}` : '';
  const callToActionPart = platform === 'nostr' ? `\n\nShared via https://pullthatupjamie.ai` : '';
  
  return `${baseContent}${signaturePart}${mediaUrlPart}${callToActionPart}`;
};
```

### Event Structure
```javascript
const event = {
  kind: 1,
  created_at: Math.floor(Date.now() / 1000), // THIS EXACT TIMESTAMP IS SENT IN platformData.nostrCreatedAt
  content: finalContent, // Built using buildFinalContent above
  tags: [] // NO r-tag, empty array
};
```

## Backend Payload Received
```json
{
  "text": "User content\n\nOptional signature\n\nhttps://cdn.example.com/video.mp4\n\nShared via https://pullthatupjamie.ai",
  "mediaUrl": "https://cdn.example.com/video.mp4",
  "scheduledFor": "2025-08-10T23:55:00.000Z",
  "platforms": ["nostr"],
  "timezone": "America/Chicago",
  "platformData": {
    "nostrEventId": "abc123...",
    "nostrSignature": "def456...", 
    "nostrPubkey": "789xyz...",
    "nostrCreatedAt": 1754930635,
    "nostrRelays": ["wss://relay.primal.net", ...]
  }
}
```

## Critical Backend Requirements

### 1) Use Exact Content
**DO NOT reconstruct content**. Use the `text` field exactly as received:
```javascript
// ✅ CORRECT
const event = {
  kind: 1,
  created_at: payload.platformData.nostrCreatedAt, // MUST use this exact timestamp
  content: payload.text, // Use exactly as received
  tags: []
};

// ❌ WRONG - Don't rebuild content
const content = `${payload.text}\n\n${payload.mediaUrl}\n\nShared via...`; // Will break signature
```

### 2) Use Exact Timestamp
The `created_at` MUST be `platformData.nostrCreatedAt`, not a new timestamp:
```javascript
created_at: payload.platformData.nostrCreatedAt // Required for signature validation
```

### 3) Signature Validation
To validate the signature before publishing:
```javascript
// Canonical serialization (NIP-01)
const serialized = JSON.stringify([
  0,
  payload.platformData.nostrPubkey,
  payload.platformData.nostrCreatedAt,
  1, // kind
  [], // tags (empty array)
  payload.text // exact content
]);

// Hash and verify signature
const hash = sha256(utf8ToBytes(serialized));
const isValid = schnorr.verify(
  payload.platformData.nostrSignature,
  hash,
  payload.platformData.nostrPubkey
);
```

### 4) Publishing Event
Publish the exact same event structure to relays:
```javascript
const eventToPublish = {
  id: payload.platformData.nostrEventId,
  sig: payload.platformData.nostrSignature,
  pubkey: payload.platformData.nostrPubkey,
  kind: 1,
  created_at: payload.platformData.nostrCreatedAt,
  content: payload.text, // Exact content from frontend
  tags: []
};

// Send to relays
relays.forEach(relay => {
  ws.send(JSON.stringify(["EVENT", eventToPublish]));
});
```

## Key Points
- **Content format**: `{userText}\n\n{optionalSignature}\n\n{mediaUrl}\n\nShared via https://pullthatupjamie.ai`
- **No r-tags**: Empty tags array `[]`
- **Exact timestamp**: Use `platformData.nostrCreatedAt`
- **Exact content**: Use `text` field as-is, don't reconstruct
- **Media handling**: Media URL is embedded in content text, not as metadata

## Why This Works
This approach embeds media URLs directly in content, which most Nostr clients (Damus, Primal, etc.) render as clickable links or embedded media, unlike r-tags which are often ignored for display purposes.
