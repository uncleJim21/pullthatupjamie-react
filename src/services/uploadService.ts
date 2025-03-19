import { API_URL } from '../constants/constants.ts';

// Constants for processing status
export const ProcessingStatus = {
  IDLE: 'IDLE',
  UPLOADING: 'UPLOADING',
  PROCESSING: 'PROCESSING',
  COMPLETE: 'COMPLETE',
  ERROR: 'ERROR'
};

// Interface for upload item
export interface UploadItem {
  key: string;
  fileName: string;
  size: number;
  lastModified: string;
  publicUrl: string;
}

// Interface for list uploads response
export interface ListUploadsResponse {
  uploads: UploadItem[];
  count: number;
  feedId: string;
}

// Processing state management
class ProcessingState {
  private listeners: Set<Function>;

  constructor() {
    this.listeners = new Set();
  }

  subscribe(listener: Function) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(status: any) {
    this.listeners.forEach(listener => listener(status));
  }
}

export const processingState = new ProcessingState();

export const updateStatus = (status: any) => {
  processingState.emit(status);
};

// Type definitions
interface PresignedUrlResponse {
  uploadUrl: string;
  key: string;
  feedId: string;
  publicUrl: string;
  maxSizeBytes: number;
  maxSizeMB: number;
}

/**
 * Fetch list of uploaded files
 */
export const getUploadsList = async (authToken: string): Promise<ListUploadsResponse> => {
  try {
    const response = await fetch(`${API_URL}/api/list-uploads`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch uploads: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching uploads list:', error);
    throw error;
  }
};

// Get a presigned URL for file upload
export const getPresignedUrl = async (
  fileName: string, 
  fileType: string, 
  authToken: string
): Promise<PresignedUrlResponse> => {
  console.log('Requesting presigned URL for:', { fileName, fileType });
  
  const response = await fetch(`${API_URL}/api/generate-presigned-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ 
      fileName, 
      fileType, 
      acl: 'public-read' 
    })
  });
  
  if (!response.ok) {
    console.error('Failed to get presigned URL:', await response.text());
    throw new Error('Failed to get presigned URL');
  }

  const data = await response.json();
  console.log('Presigned URL Data:', {
    uploadUrl: data.uploadUrl,
    key: data.key,
    feedId: data.feedId,
    maxSizeMB: data.maxSizeMB
  });
  
  return data;
};

/**
 * Direct XMLHttpRequest upload to S3/DigitalOcean Spaces using presigned URL
 * This function is intended to be the most reliable method for uploads
 */
export const directUpload = async (
  file: File,
  presignedUrl: string,
  onProgress?: (progress: number) => void
): Promise<XMLHttpRequest> => {
  return new Promise((resolve, reject) => {
    // Create new XMLHttpRequest
    const xhr = new XMLHttpRequest();
    
    // Set up request
    xhr.open('PUT', presignedUrl, true);
    xhr.timeout = 30 * 60 * 1000; // 30 minutes timeout
    
    // Set headers - keeping this minimal to avoid CORS issues
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.setRequestHeader('x-amz-acl', 'public-read');
    
    // Don't send cookies
    xhr.withCredentials = false;
    
    // Handle progress events
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percentComplete = (event.loaded / event.total) * 100;
        onProgress(percentComplete);
      }
    };
    
    // Handle completion
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        console.log('Upload completed successfully');
        resolve(xhr);
      } else {
        console.error('Upload failed with status:', xhr.status);
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };
    
    // Handle network errors
    xhr.onerror = () => {
      console.error('Network error during upload');
      reject(new Error('Network error during upload'));
    };
    
    // Handle timeouts
    xhr.ontimeout = () => {
      console.error('Upload timed out');
      reject(new Error('Upload timed out'));
    };
    
    // Handle aborts
    xhr.onabort = () => {
      console.error('Upload aborted');
      reject(new Error('Upload was aborted'));
    };
    
    // Send the file
    xhr.send(file);
    
    // Return the xhr object so it can be aborted if needed
    return xhr;
  });
};

/**
 * Process a file upload with status tracking
 * This is the primary function to use for uploads
 */
export const processFileUpload = async (file: File, authToken: string) => {
  let xhr: XMLHttpRequest | null = null;
  let aborted = false;
  
  try {
    // Step 1: Start the process and update status
    updateStatus({
      status: ProcessingStatus.UPLOADING,
      message: 'Initializing upload...',
      progress: 5
    });
    
    // Step 2: Get presigned URL
    updateStatus({
      status: ProcessingStatus.UPLOADING,
      message: 'Requesting upload URL...',
      progress: 10
    });
    
    const presignedData = await getPresignedUrl(file.name, file.type, authToken);
    const { uploadUrl, key, publicUrl } = presignedData;
    
    // Extract a unique ID from the key (typically format: folder/id/filename)
    const uploadId = key.split('/')[1] || 'unknown';
    
    // Step 3: Upload the file
    updateStatus({
      status: ProcessingStatus.UPLOADING,
      message: 'Uploading file...',
      progress: 20,
      uploadId
    });
    
    // Start the upload
    xhr = await directUpload(file, uploadUrl, (progress) => {
      // Scale progress from 20-90%
      const scaledProgress = 20 + (progress * 0.7);
      
      updateStatus({
        status: ProcessingStatus.UPLOADING,
        message: progress < 100 ? 'Uploading file...' : 'Upload complete, processing...',
        progress: scaledProgress,
        uploadId
      });
    });
    
    // Check if aborted during upload
    if (aborted) {
      throw new Error('Upload was cancelled');
    }
    
    // Step 4: Processing phase - Just a brief pause for UX purposes
    updateStatus({
      status: ProcessingStatus.PROCESSING,
      message: 'Finalizing upload...',
      progress: 95,
      uploadId
    });
    
    // Brief delay for UX purposes
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 5: Complete
    updateStatus({
      status: ProcessingStatus.COMPLETE,
      message: 'Upload complete!',
      progress: 100,
      uploadId,
      data: {
        fileUrl: publicUrl || `${uploadUrl.split('?')[0]}`, // Extract the base URL without query params
        key,
        fileName: file.name
      }
    });
    
    return {
      fileUrl: publicUrl || `${uploadUrl.split('?')[0]}`,
      uploadId,
      key,
      fileName: file.name
    };
    
  } catch (error) {
    // Handle errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during upload';
    console.error('Upload process error:', errorMessage);
    
    updateStatus({
      status: ProcessingStatus.ERROR,
      message: errorMessage,
      progress: 0
    });
    
    throw error;
  }
};

/**
 * Cancel an in-progress upload
 */
export const cancelUpload = (xhr: XMLHttpRequest | null) => {
  if (xhr && xhr.readyState !== 4) {
    xhr.abort();
    updateStatus({
      status: ProcessingStatus.IDLE,
      message: 'Upload cancelled',
      progress: 0
    });
    return true;
  }
  return false;
};

const UploadService = {
  getPresignedUrl,
  directUpload,
  processFileUpload,
  cancelUpload,
  getUploadsList,
  ProcessingStatus,
  processingState
};

export default UploadService; 