# Backend Update: Nostr Primal URL Support

## Summary
The frontend now calculates and sends Primal URLs for Nostr posts during scheduling. The backend needs to be updated to handle and store this new field.

## Changes Required

### 1. Database Schema Update
Add the `nostrPostUrl` field to the SocialPost model's `platformData` section:

```javascript
// In models/SocialPost.js
platformData: {
  // ... existing fields
  nostrPostUrl: { type: String, required: false }, // Add this line
}
```

### 2. API Payload Changes
The frontend now sends an additional field in `platformData` for Nostr posts:

```json
{
  "platformData": {
    "nostrEventId": "abc123...",
    "nostrSignature": "def456...",
    "nostrPubkey": "789xyz...",
    "nostrCreatedAt": 1754933942,
    "nostrRelays": ["wss://relay.primal.net", ...],
    "nostrPostUrl": "https://primal.net/e/nevent1abc123..."
  }
}
```

### 3. Backend Processing Updates

#### In `routes/socialPostRoutes.js`:
The route already copies `platformData` fields, so no changes needed if using `Object.assign(platformData, req.body.platformData)`.

#### In `utils/SocialPostProcessor.js`:
When processing Nostr posts, preserve the client-calculated Primal URL instead of generating a new one:

```javascript
// In processPost method for Nostr posts
if (result.success) {
  await SocialPost.findByIdAndUpdate(post._id, {
    status: 'posted',
    postedAt: new Date(),
    'platformData.nostrEventId': result.eventId,
    // Use the existing nostrPostUrl if present, otherwise fall back to generated one
    'platformData.nostrPostUrl': post.platformData.nostrPostUrl || result.primalUrl
  });
}
```

## Benefits
- **Consistency**: The Primal URL shown in the UI matches the one calculated at signing time
- **Reliability**: No dependency on backend URL generation for already-signed events
- **User Experience**: Immediate URL availability in the scheduled posts list

## Testing
1. Create a new Nostr scheduled post via the frontend
2. Verify the `nostrPostUrl` field is saved in the database
3. After the post is published, confirm the URL in the UI matches the saved URL

## Backward Compatibility
This change is backward compatible - existing posts without `nostrPostUrl` will continue to work with the existing backend URL generation logic.
