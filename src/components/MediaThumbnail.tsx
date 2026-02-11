import React, { useState } from 'react';

interface MediaThumbnailProps {
  fileUrl: string;
  fileName: string;
  className?: string;
  width?: number;
  height?: number;
}

const MediaThumbnail: React.FC<MediaThumbnailProps> = ({
  fileUrl,
  fileName,
  className = '',
  width = 60,
  height = 60
}) => {
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [thumbnailRetry, setThumbnailRetry] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  // Determine file type
  const fileExtension = fileName.split('.').pop()?.toLowerCase();
  const isVideo = fileExtension && ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv'].includes(fileExtension);
  const isImage = fileExtension && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(fileExtension);
  const isAudio = fileExtension && ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(fileExtension);

  // For video, try to use a thumbnail if CDN supports it
  const videoThumbnailUrl = isVideo ? `${fileUrl}?thumbnail=1` : undefined;

  const playIconSize = Math.min(width, height) * 0.4;

  return (
    <div
      className={`relative bg-gray-800 rounded-lg overflow-hidden flex-shrink-0 ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Shimmer while loading */}
      {!previewLoaded && !thumbnailFailed && (
        <div
          className="absolute inset-0 shimmer-loading"
          style={{ zIndex: 1 }}
        />
      )}

      {/* Video thumbnail */}
      {isVideo && !thumbnailFailed && (
        <img
          src={videoThumbnailUrl + (thumbnailRetry ? `&retry=1` : '')}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            display: previewLoaded ? 'block' : 'none',
            zIndex: 2,
          }}
          onLoad={() => setPreviewLoaded(true)}
          onError={() => {
            if (!thumbnailRetry) {
              setTimeout(() => setThumbnailRetry(true), 3000);
            } else {
              setThumbnailFailed(true);
            }
          }}
        />
      )}

      {/* Video fallback if thumbnail failed */}
      {isVideo && thumbnailFailed && (
        <video
          src={fileUrl}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            zIndex: 2,
            background: '#374151',
          }}
          muted
          playsInline
          preload="metadata"
          onLoadedData={(e) => {
            (e.target as HTMLVideoElement).currentTime = 0;
            setPreviewLoaded(true);
          }}
        />
      )}

      {/* Image */}
      {isImage && (
        <img
          src={fileUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            display: previewLoaded ? 'block' : 'none',
            zIndex: 2,
          }}
          onLoad={() => setPreviewLoaded(true)}
        />
      )}

      {/* Audio placeholder */}
      {isAudio && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-700" style={{ zIndex: 2 }}>
          <svg width={playIconSize} height={playIconSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 5V19L19 12L8 5Z" fill="white" />
          </svg>
        </div>
      )}

      {/* Play icon overlay for video */}
      {isVideo && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            zIndex: 3,
          }}
        >
          <div
            className="bg-black bg-opacity-50 rounded-full flex items-center justify-center"
            style={{
              width: playIconSize,
              height: playIconSize,
            }}
          >
            <svg width={playIconSize - 8} height={playIconSize - 8} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 5V19L19 12L8 5Z" fill="white" />
            </svg>
          </div>
        </div>
      )}

      {/* File type icon for unknown types */}
      {!isVideo && !isImage && !isAudio && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-600" style={{ zIndex: 2 }}>
          <svg width={playIconSize} height={playIconSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="white" />
          </svg>
        </div>
      )}

    </div>
  );
};

export default MediaThumbnail;
