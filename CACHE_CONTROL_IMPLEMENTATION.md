# Cache-Control Implementation in Upload Service

## Overview

The `uploadService.ts` has been updated to support Cache-Control headers for optimal file caching and performance. **Cache-Control is now enabled by default** for all uploads.

## Changes Made

### 1. Updated `PresignedUrlResponse` Interface
```typescript
interface PresignedUrlResponse {
  uploadUrl: string;
  key: string;
  feedId: string;
  publicUrl: string;
  maxSizeBytes: number;
  maxSizeMB: number;
  cacheControl?: boolean | string;  // NEW: Added cacheControl field
}
```

### 2. Updated `getPresignedUrl` Function
- **Added `cacheControl` parameter with default value of `true`**
- Sends `cacheControl` to the backend API
- Logs the `cacheControl` value in the response

```typescript
export const getPresignedUrl = async (
  fileName: string, 
  fileType: string, 
  authToken: string,
  cacheControl: boolean | string = true  // Defaults to true
): Promise<PresignedUrlResponse>
```

### 3. Updated `directUpload` Function
- **Added `cacheControl` parameter**
- **CRITICAL**: Sets the `Cache-Control` header when uploading to S3/Spaces
- Uses default value `'public, max-age=31536000, immutable'` when `cacheControl === true`
- Supports custom Cache-Control strings

```typescript
export const directUpload = async (
  file: File,
  presignedUrl: string,
  cacheControl?: boolean | string,  // NEW parameter
  onProgress?: (progress: number) => void
): Promise<XMLHttpRequest>
```

**Implementation Detail:**
```typescript
if (cacheControl) {
  const cacheControlValue = typeof cacheControl === 'string' 
    ? cacheControl 
    : 'public, max-age=31536000, immutable';
  
  xhr.setRequestHeader('Cache-Control', cacheControlValue);
  console.log('Setting Cache-Control header:', cacheControlValue);
}
```

### 4. Updated `processFileUpload` Function
- **Added `cacheControl` parameter with default value of `true`**
- Passes `cacheControl` to `getPresignedUrl`
- Passes the response `cacheControl` to `directUpload`

```typescript
export const processFileUpload = async (
  file: File, 
  authToken: string,
  cacheControl: boolean | string = true  // Defaults to true
)
```

## Default Behavior

**By default, all uploads now use Cache-Control with the following header:**
```
Cache-Control: public, max-age=31536000, immutable
```

This means:
- ✅ Files are cached for 1 year (31,536,000 seconds)
- ✅ Files are marked as `immutable` (won't change at this URL)
- ✅ Files are cached by browsers and CDNs
- ✅ Significantly improves performance for repeated access

## Usage Examples

### Default Usage (Cache-Control enabled)
```typescript
// Cache-Control is automatically enabled
await UploadService.processFileUpload(file, authToken);
```

### Disable Cache-Control
```typescript
// Explicitly disable Cache-Control
await UploadService.processFileUpload(file, authToken, false);
```

### Custom Cache-Control Value
```typescript
// Use a custom Cache-Control header
await UploadService.processFileUpload(
  file, 
  authToken, 
  'public, max-age=86400'  // 1 day cache
);
```

## Benefits

1. **Performance**: Browsers cache files for 1 year, reducing repeated downloads
2. **Bandwidth**: Saves bandwidth for both client and server
3. **CDN Efficiency**: CloudFront/CDN can cache files aggressively
4. **User Experience**: Faster subsequent page loads
5. **Immutable Flag**: Tells browsers the file will never change at this URL

## When to Disable Cache-Control

Consider disabling Cache-Control (`cacheControl: false`) for:
- Files that might be updated/replaced at the same URL
- Temporary uploads
- Work-in-progress content
- Files where immediate updates must be visible

For published/final content (videos, images, audio), the default behavior is optimal.

## Backend Requirements

The backend API must:
1. Accept the `cacheControl` parameter in the POST request
2. Include the appropriate `Cache-Control` header when generating the presigned URL
3. Return the `cacheControl` value in the response

## Testing

After uploading a file with Cache-Control enabled, verify the headers:

```bash
curl -I https://your-bucket.endpoint.com/path/to/file.mp4

# Should see:
# Cache-Control: public, max-age=31536000, immutable
```

## Notes

- This is backward compatible - existing code continues to work
- The default provides optimal caching for most use cases
- Files with long-term caching should use unique filenames for updates
- The implementation follows AWS S3 and DigitalOcean Spaces best practices

