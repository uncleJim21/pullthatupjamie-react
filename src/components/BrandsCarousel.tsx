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
        name: 'TFTC: A Bitcoin Podcast',
        imageUrl: 'https://cascdr-chads-stay-winning.nyc3.digitaloceanspaces.com/jamie-pro/550168/uploads/1764005588287-tftc-cover.jpg',
        width: 150,
        height: 150,
      },
    {
        name: 'Ungovernable Misfits',
        imageUrl: 'https://cascdr-chads-stay-winning.nyc3.digitaloceanspaces.com/jamie-pro/550168/uploads/1764005499982-ugmf-cover.jpg',
        width: 150,
        height: 150,
      },
  {
    name: 'THE Bitcoin Podcast',
    imageUrl: 'https://cascdr-chads-stay-winning.nyc3.digitaloceanspaces.com/jamie-pro/550168/uploads/1764005597054-tbp-walker.jpg',
    width: 150,
    height: 150,
  },
  {
    name: 'Stacker News Live',
    imageUrl: 'https://cascdr-chads-stay-winning.nyc3.digitaloceanspaces.com/jamie-pro/550168/uploads/1764005574138-snl-cover.jpg',
    width: 150,
    height: 150,
  },
  {
    name: 'Build with Bitcoin',
    imageUrl: 'https://cascdr-chads-stay-winning.nyc3.digitaloceanspaces.com/jamie-pro/550168/uploads/1764005565516-bwb-cover.jpeg',
    width: 150,
    height: 150,
  },
  {
    name: 'News and Guidance',
    imageUrl: 'https://cascdr-chads-stay-winning.nyc3.digitaloceanspaces.com/jamie-pro/550168/uploads/1764005556601-news-and-guidance.jpg',
    width: 150,
    height: 150,
  },
  {
    name: 'Trust Revolution',
    imageUrl: 'https://cascdr-chads-stay-winning.nyc3.digitaloceanspaces.com/jamie-pro/550168/uploads/1764005539511-trust-revolution.jpg',
    width: 150,
    height: 150,
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
    const speed = 0.75; // pixels per frame

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
        padding: '20px 0',
        position: 'relative',
      }}
    >
      {/* Title */}
      <h3
        style={{
          fontSize: '32px',
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: '32px',
          color: 'white',
        }}
      >
        Trusted by the Best
      </h3>
      
      {/* Carousel Container */}
      <div
        style={{
          width: '100%',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
      <div
        style={{
          width: '100%',
          maxWidth: '800px',
          margin: '0 auto',
          overflow: 'hidden',
          position: 'relative',
          maskImage: 'linear-gradient(to right, rgba(0, 0, 0, 0) 0%, rgb(0, 0, 0) 10%, rgb(0, 0, 0) 90%, rgba(0, 0, 0, 0) 100%)',
          WebkitMaskImage: 'linear-gradient(to right, rgba(0, 0, 0, 0) 0%, rgb(0, 0, 0) 10%, rgb(0, 0, 0) 90%, rgba(0, 0, 0, 0) 100%)',
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
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {brand.link ? (
              <a
                href={brand.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  textDecoration: 'none',
                }}
              >
                <img
                  src={brand.imageUrl}
                  alt={brand.name}
                  style={{
                    width: '150px',
                    height: '150px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    opacity: 1,
                  }}
                />
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: 'white',
                    textAlign: 'center',
                    maxWidth: '150px',
                  }}
                >
                  {brand.name}
                </span>
              </a>
            ) : (
              <>
                <img
                  src={brand.imageUrl}
                  alt={brand.name}
                  style={{
                    width: '150px',
                    height: '150px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    opacity: 1,
                  }}
                />
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: 'white',
                    textAlign: 'center',
                    maxWidth: '150px',
                  }}
                >
                  {brand.name}
                </span>
              </>
            )}
          </div>
        ))}
        </div>
      </div>
      </div>
    </div>
  );
};

export default BrandsCarousel;

