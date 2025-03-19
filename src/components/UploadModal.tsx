import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, Copy, Check } from 'lucide-react';
import UploadService, { ProcessingStatus, processingState } from '../services/uploadService.ts';

interface UploadModalProps {
  onClose: () => void;
}

// Upload states
type UploadState = 'idle' | 'uploading' | 'success' | 'error';

const UploadModal: React.FC<UploadModalProps> = ({ onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [xhr, setXhr] = useState<XMLHttpRequest | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileUrlInputRef = useRef<HTMLInputElement>(null);

  // Listen for status updates from the upload service
  useEffect(() => {
    const unsubscribe = processingState.subscribe((status) => {
      // Update UI based on status updates
      if (status.status === ProcessingStatus.UPLOADING || 
          status.status === ProcessingStatus.PROCESSING) {
        setUploadState('uploading');
        setUploadProgress(status.progress || 0);
        setStatusMessage(status.message || 'Processing...');
        
        if (status.uploadId && !uploadId) {
          setUploadId(status.uploadId);
        }
      } else if (status.status === ProcessingStatus.COMPLETE) {
        setUploadState('success');
        setUploadProgress(100);
        setStatusMessage('Upload complete!');
        
        // Store the file URL if available
        if (status.data && status.data.fileUrl) {
          setFileUrl(status.data.fileUrl);
        }
      } else if (status.status === ProcessingStatus.ERROR) {
        setUploadState('error');
        setError(status.message || 'An error occurred');
      }
    });
    
    // Clean up subscription when component unmounts
    return () => {
      unsubscribe();
    };
  }, [uploadId]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      setFile(event.dataTransfer.files[0]);
      setError(null);
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      setError(null);
    }
  }, []);

  const handleUpload = async () => {
    if (!file) return;

    try {
      // Reset state
      setUploadState('uploading');
      setError(null);
      setUploadProgress(0);
      setFileUrl(null);

      // Get auth token from localStorage
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error('Authentication required');
      }

      console.log('Starting upload process for:', file.name);

      // Start the upload process
      await UploadService.processFileUpload(file, authToken);

      // Success handling is done via the status subscription
    } catch (err) {
      console.error('Upload failed:', err);
      
      // Error handling is generally done via the status subscription,
      // but we'll handle any uncaught errors here as a fallback
      
      if (err instanceof Error) {
        // If error wasn't already set by the status subscription
        if (uploadState !== 'error') {
          setUploadState('error');
          
          let errorMessage = err.message;
          
          // Provide more helpful messages for common errors
          if (err.message.includes('CORS') || err.message.includes('Network error') || err.message.includes('status: 0')) {
            errorMessage = 'Upload failed due to cross-origin restrictions. Our team has been notified of this issue.';
          } else if (err.message.includes('403')) {
            errorMessage = 'Access denied (403): The upload URL may have expired or you don\'t have permission.';
          }
          
          setError(errorMessage);
        }
      }
    }
  };

  const handleCancel = () => {
    if (uploadState === 'uploading' && xhr) {
      UploadService.cancelUpload(xhr);
    }
    onClose();
  };

  const handleCopyUrl = () => {
    if (fileUrl && fileUrlInputRef.current) {
      fileUrlInputRef.current.select();
      document.execCommand('copy');
      // Modern clipboard API
      navigator.clipboard.writeText(fileUrl).then(() => {
        setCopied(true);
        // Reset copy state after 2 seconds
        setTimeout(() => setCopied(false), 2000);
      }).catch(err => {
        console.error('Failed to copy:', err);
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50">
      <div className="bg-[#111111] border border-gray-800 rounded-lg p-6 w-96 text-center relative">
        <button 
          onClick={handleCancel} 
          className="absolute top-2 right-2 text-gray-400 hover:text-white"
          disabled={uploadState === 'uploading'}
        >
          &times;
        </button>
        <h2 className="text-lg font-semibold text-white mb-4">Upload File</h2>
        
        <div 
          className={`border-2 border-dashed ${uploadState === 'error' ? 'border-red-500' : 'border-gray-600'} rounded-lg p-8 mb-4 transition-colors
            ${!file && uploadState === 'idle' ? 'hover:border-blue-500' : ''}`}
          onDrop={uploadState === 'idle' ? handleDrop : undefined}
          onDragOver={uploadState === 'idle' ? handleDragOver : undefined}
        >
          {file ? (
            <div className="text-gray-400">
              <p className="font-medium text-white">Selected File:</p>
              <p className="mt-1">{file.name}</p>
              <p className="text-sm mt-1">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          ) : (
            <p className="text-gray-400">
              Drag and drop your file here<br />
              <span className="text-sm">or click below to browse</span>
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-md flex items-start text-left">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {uploadState === 'uploading' && (
          <div className="mb-4">
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-gray-400 text-sm mt-1">
              <span>{statusMessage}</span>
              <span>{uploadProgress.toFixed(0)}%</span>
            </div>
          </div>
        )}

        {uploadState === 'success' && (
          <div className="mb-4">
            <div className="p-3 bg-green-900/30 border border-green-800 rounded-md text-center mb-3">
              <p className="text-green-400">Upload successful!</p>
            </div>
            
            {fileUrl && (
              <div className="flex items-center">
                <input
                  ref={fileUrlInputRef}
                  type="text"
                  value={fileUrl}
                  readOnly
                  className="flex-1 bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded-l-md text-sm overflow-hidden"
                />
                <button
                  onClick={handleCopyUrl}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-r-md"
                  title="Copy URL"
                >
                  {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <input 
            type="file" 
            onChange={handleFileChange} 
            className="hidden" 
            id="fileInput"
            disabled={uploadState === 'uploading'}
          />
          
          {/* File selection button for empty state */}
          {!file && uploadState === 'idle' && (
            <label 
              htmlFor="fileInput" 
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 cursor-pointer disabled:opacity-50"
            >
              Select File
            </label>
          )}

          {/* Upload button for file selected or error states */}
          {file && (uploadState === 'idle' || uploadState === 'error') && (
            <button
              onClick={handleUpload}
              disabled={false}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center"
            >
              Upload File
            </button>
          )}

          {/* Uploading state */}
          {uploadState === 'uploading' && (
            <button
              onClick={handleCancel}
              className="bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-600 flex items-center justify-center"
            >
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Cancel Upload
            </button>
          )}

          {/* Success state */}
          {uploadState === 'success' && (
            <button
              onClick={onClose}
              className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadModal; 