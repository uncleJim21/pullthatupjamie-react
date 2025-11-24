import React, { useEffect, useRef, useState } from 'react';

interface Brand {
  name: string;
  imageUrl: string;
  width: number;
  height: number;
  link?: string;
}

const brands: Brand[] = [
  {
    name: 'Stacker News',
    imageUrl: '/stacker-news-logo.png',
    width: 200,
    height: 60,
  },
  {
    name: 'Nostr',
    imageUrl: '/nostr-logo.png',
    width: 180,
    height: 60,
  },
  {
    name: 'Bitcoin',
    imageUrl: '/icons/bitcoin.png',
    width: 60,
    height: 60,
  },
  {
    name: 'Tech',
    imageUrl: '/icons/tech.png',
    width: 60,
    height: 60,
  },
  {
    name: 'Economics',
    imageUrl: '/icons/economics.png',
    width: 60,
    height: 60,
  },
  {
    name: 'Politics',
    imageUrl: '/icons/politics.png',
    width: 60,
    height: 60,
  },
];

const BrandsCarousel: React.FC = () => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    // Calculate the width of one set of brands
    const calculateWidth = () => {
      const children = Array.from(carousel.children);
      if (children.length === 0) return 0;
      
      // Get width of half the children (one complete set)
      const halfLength = Math.floor(children.length / 3);
      let width = 0;
      for (let i = 0; i < halfLength; i++) {
        const child = children[i] as HTMLElement;
        width += child.offsetWidth;
      }
      // Add gaps
      width += 48 * (halfLength - 1);
      return width;
    };

    // Wait for images to load before calculating width
    setTimeout(() => {
      const width = calculateWidth();
      setContentWidth(width);
    }, 100);

    let animationFrameId: number;
    let position = 0;
    const speed = 0.5; // pixels per frame

    const animate = () => {
      if (contentWidth === 0) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      position -= speed;
      
      // Reset position seamlessly when we've scrolled one full set
      // Adding gap width to account for the space between items
      const resetPoint = -(contentWidth + 48);
      if (position <= resetPoint) {
        position = 0;
      }
      
      carousel.style.transform = `translateX(${position}px)`;
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [contentWidth]);

  // Triple the brands for truly seamless looping
  const triplicatedBrands = [...brands, ...brands, ...brands];

  return (
    <div
      style={{
        width: '100%',
        overflow: 'hidden',
        padding: '20px 0',
        position: 'relative',
        maskImage: 'linear-gradient(to right, rgba(0, 0, 0, 0) 0%, rgb(0, 0, 0) 12.5%, rgb(0, 0, 0) 87.5%, rgba(0, 0, 0, 0) 100%)',
        WebkitMaskImage: 'linear-gradient(to right, rgba(0, 0, 0, 0) 0%, rgb(0, 0, 0) 12.5%, rgb(0, 0, 0) 87.5%, rgba(0, 0, 0, 0) 100%)',
      }}
    >
      <div
        ref={carouselRef}
        style={{
          display: 'flex',
          gap: '48px',
          alignItems: 'center',
          willChange: 'transform',
        }}
      >
        {triplicatedBrands.map((brand, index) => (
          <div
            key={`${brand.name}-${index}`}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '150px',
              height: '80px',
            }}
          >
            {brand.link ? (
              <a
                href={brand.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                }}
              >
                <img
                  src={brand.imageUrl}
                  alt={brand.name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    opacity: 0.7,
                    transition: 'opacity 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '0.7';
                  }}
                />
              </a>
            ) : (
              <img
                src={brand.imageUrl}
                alt={brand.name}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  opacity: 0.7,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BrandsCarousel;

