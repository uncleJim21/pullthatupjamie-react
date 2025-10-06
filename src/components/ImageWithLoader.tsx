import React, { useState, useEffect } from 'react';

interface ImageWithLoaderProps {
  src: string;
  alt: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
  loadingClassName?: string;
  retryDelay?: number; // Delay before showing error state
}

export const ImageWithLoader: React.FC<ImageWithLoaderProps> = ({
  src,
  alt,
  className = '',
  onLoad,
  onError,
  loadingClassName = 'bg-gray-800 animate-pulse',
  retryDelay = 5000 // 5 seconds before showing error
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showError, setShowError] = useState(false);

  // Reset states when src changes
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setShowError(false);
  }, [src]);

  const handleLoad = () => {
    setImageLoaded(true);
    setImageError(false);
    setShowError(false);
    onLoad?.();
  };

  const handleError = () => {
    setImageLoaded(false);
    setImageError(true);
    
    // Only show error message after delay
    setTimeout(() => {
      if (!imageLoaded) {
        setShowError(true);
      }
    }, retryDelay);
    
    onError?.();
  };

  return (
    <div className="relative">
      {!imageLoaded && !showError && (
        <div className={`w-full h-full ${loadingClassName}`} />
      )}
      {showError && (
        <div className={`w-full h-full ${loadingClassName} flex items-center justify-center text-gray-500 text-sm`}>
          Image unavailable
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} ${
          imageLoaded ? 'block' : 'hidden'
        }`}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
};

export default ImageWithLoader;
