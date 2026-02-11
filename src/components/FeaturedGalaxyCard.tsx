import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { View, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { ArrowUpRight } from 'lucide-react';
import { fetchSharedResearchSession, fetchResearchSessionWith3D } from '../services/researchSessionShareService.ts';

// ============================================================================
// COLOR UTILITIES - Match SemanticGalaxyView rendering
// ============================================================================

/**
 * Transform color to compensate for additive blending brightening.
 * This darkens/saturates colors so they look correct after being brightened.
 * CRITICAL: Without this, additive blending washes colors to white.
 */
const transformColorForBlending = (hexColor: string, factor: number = 0.5): string => {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Darken by multiplying each channel by the factor
  const newR = Math.round(r * factor);
  const newG = Math.round(g * factor);
  const newB = Math.round(b * factor);
  
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
};

/**
 * Boost saturation for preview cards to improve hue readability.
 * Previews are smaller, so colors need to "pop" more.
 */
const boostSaturation = (hexColor: string, boostFactor: number = 1.3): string => {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  // Convert RGB to HSL
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  // Boost saturation (clamp to 1.0)
  const newS = Math.min(1, s * boostFactor);
  
  // Convert back to RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  
  const q = l < 0.5 ? l * (1 + newS) : l + newS - l * newS;
  const p = 2 * l - q;
  const newR = Math.round(hue2rgb(p, q, h + 1/3) * 255);
  const newG = Math.round(hue2rgb(p, q, h) * 255);
  const newB = Math.round(hue2rgb(p, q, h - 1/3) * 255);
  
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
};

// ============================================================================
// CONFIGURATION - Matches SemanticGalaxyView star styling
// ============================================================================
const MINI_GALAXY_CONFIG = {
  CAMERA_DISTANCE: 5,
  ROTATION_SPEED: 0.13,
  // Color processing for preview cards
  COLOR_BLEND_FACTOR: 0.55,    // Darker than embed (0.65) to compensate for small size
  SATURATION_BOOST: 1.4,       // Boost saturation for better hue readability
  // Star visual config - tuned for preview readability
  STAR: {
    CORE_SIZE: 0.052,
    CORE_GLOW_SIZE: 0.104,
    CORE_GLOW_OPACITY: 0.5,    // Reduced from 0.6
    // Main diffraction spikes (4 cross pattern)
    SPIKE_LENGTH: 0.455,
    SPIKE_WIDTH: 0.0195,
    SPIKE_OPACITY: 0.55,       // Reduced from 0.7
    // More halo layers for smoother falloff (matches embed approach)
    HALO_LAYERS: [
      { size: 0.10, opacity: 0.35 },
      { size: 0.15, opacity: 0.25 },
      { size: 0.20, opacity: 0.18 },
      { size: 0.26, opacity: 0.12 },
      { size: 0.33, opacity: 0.06 },
      { size: 0.42, opacity: 0.03 },
    ],
  },
};

// ============================================================================
// TYPES
// ============================================================================
interface StarPoint {
  x: number;
  y: number;
  z: number;
}

interface FeaturedGalaxyCardProps {
  shareId: string;
  fallbackTitle?: string;
  fallbackColor?: string;
  onClick?: () => void;
  /** Ref to the horizontal scroll container — used to detect when the card
      is partially scrolled offscreen so we can hide the View (prevents star bleed). */
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
}

// ============================================================================
// INDIVIDUAL STAR WITH CROSS SPIKES
// ============================================================================
const MiniStar: React.FC<{
  position: [number, number, number];
  color: THREE.Color;
  scale?: number;
}> = ({ position, color, scale = 1 }) => {
  const config = MINI_GALAXY_CONFIG.STAR;
  
  return (
    <group position={position} scale={scale}>
      {/* Bright Core */}
      <mesh>
        <sphereGeometry args={[config.CORE_SIZE, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      
      {/* Core Glow */}
      <mesh>
        <sphereGeometry args={[config.CORE_GLOW_SIZE, 8, 8]} />
        <meshBasicMaterial
          color={color}
          opacity={config.CORE_GLOW_OPACITY}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      
      {/* Soft Halos */}
      {config.HALO_LAYERS.map((layer, index) => (
        <mesh key={`halo-${index}`}>
          <sphereGeometry args={[layer.size, 8, 8]} />
          <meshBasicMaterial
            color={color}
            opacity={layer.opacity}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      
      {/* 4 Main Diffraction Spikes (Cross Pattern) */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2;
        return (
          <mesh key={`spike-${i}`} rotation={[0, 0, angle]}>
            <boxGeometry args={[config.SPIKE_LENGTH, config.SPIKE_WIDTH, config.SPIKE_WIDTH]} />
            <meshBasicMaterial
              color={color}
              opacity={config.SPIKE_OPACITY}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}
    </group>
  );
};

// ============================================================================
// MINI STAR FIELD COMPONENT - Using individual cross-shaped stars
// ============================================================================
const MiniStarField: React.FC<{
  points: StarPoint[];
  themeColor: string;
}> = ({ points, themeColor }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Process color for additive blending: boost saturation, then darken
  // This preserves hue identity while preventing washout
  const processedColor = useMemo(() => {
    const boosted = boostSaturation(themeColor, MINI_GALAXY_CONFIG.SATURATION_BOOST);
    const transformed = transformColorForBlending(boosted, MINI_GALAXY_CONFIG.COLOR_BLEND_FACTOR);
    return new THREE.Color(transformed);
  }, [themeColor]);
  
  // Pre-compute star colors and scales with slight variation (memoized to prevent twinkling on re-render)
  const { starColors, starScales } = useMemo(() => {
    const colors = points.map(() => {
      const variation = 0.8 + Math.random() * 0.4; // Tighter range for more consistent hue
      return new THREE.Color(
        processedColor.r * variation,
        processedColor.g * variation,
        processedColor.b * variation
      );
    });
    const scales = points.map(() => 0.8 + Math.random() * 0.4);
    return { starColors: colors, starScales: scales };
  }, [points, processedColor]);
  
  // Gentle rotation animation
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * MINI_GALAXY_CONFIG.ROTATION_SPEED;
    }
  });
  
  if (points.length === 0) return null;
  
  return (
    <group ref={groupRef}>
      {points.map((point, i) => (
        <MiniStar
          key={i}
          position={[point.x, point.y, point.z]}
          color={starColors[i]}
          scale={starScales[i]}
        />
      ))}
    </group>
  );
};

// ============================================================================
// MAIN CARD COMPONENT
// Uses <View> from @react-three/drei to render into the shared Canvas via
// WebGL scissoring. One WebGL context for ALL cards — no context limits.
// ============================================================================
export const FeaturedGalaxyCard: React.FC<FeaturedGalaxyCardProps> = ({
  shareId,
  fallbackTitle,
  fallbackColor = '#4ECDC4',
  onClick,
  scrollContainerRef,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const [isFullyInView, setIsFullyInView] = useState(true);

  const [points, setPoints] = useState<StarPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Live data from backend
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [themeColor, setThemeColor] = useState<string>(fallbackColor);

  // ---------- Visibility tracking (for lazy data fetching) ----------
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasBeenVisible(true);
        }
      },
      { rootMargin: '300px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ---------- Scroll-container clipping ----------
  // Only render the View when the card is fully inside the scroll container's
  // visible area. This prevents stars from bleeding past partially-offscreen cards.
  useEffect(() => {
    const el = cardRef.current;
    const root = scrollContainerRef?.current;
    if (!el || !root) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show stars when card is ≥80% visible — keeps both cards lit during scroll
        setIsFullyInView(entry.intersectionRatio >= 0.8);
      },
      { root, threshold: [0, 0.25, 0.5, 0.8, 1.0] },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollContainerRef]);

  // ---------- Lazy data fetch ----------
  // Only fires after the card has been visible at least once.
  useEffect(() => {
    if (!hasBeenVisible) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Step 1: Get the researchSessionId and metadata from the shareId
        const sharedSession = await fetchSharedResearchSession(shareId);
        
        if (!sharedSession || !sharedSession.researchSessionId) {
          throw new Error('Invalid shared session');
        }
        
        // Extract metadata from shared session
        if (sharedSession.title) {
          setSessionTitle(sharedSession.title);
        }
        if (sharedSession.brandColors && sharedSession.brandColors.length > 0) {
          const color = sharedSession.brandColors[0];
          setThemeColor(color.startsWith('#') ? color : `#${color}`);
        }
        
        // Step 2: Fetch the 3D coordinates using the researchSessionId
        const data = await fetchResearchSessionWith3D(sharedSession.researchSessionId);
        
        if (data.results && data.results.length > 0) {
          const starPoints: StarPoint[] = data.results.map((result: any) => ({
            x: result.coordinates3d?.x ?? 0,
            y: result.coordinates3d?.y ?? 0,
            z: result.coordinates3d?.z ?? 0,
          }));
          setPoints(starPoints);
        }
      } catch (err) {
        console.error(`[FeaturedGalaxyCard] Error loading session ${shareId}:`, err);
        setError('Failed to load');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [hasBeenVisible, shareId]);
  
  // Use live title or fallback
  const displayTitle = sessionTitle || fallbackTitle;
  
  // Show the 3D View only when data is ready AND card is fully inside the scroll area
  const showStars = !isLoading && !error && points.length > 0 && isFullyInView;

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className="relative flex-shrink-0 w-[calc(50vw-64px)] h-[calc(50vw-24px)] sm:w-44 sm:h-44 md:w-52 md:h-52 sm:max-w-none sm:max-h-none rounded-lg overflow-hidden cursor-pointer group transition-all duration-300 hover:scale-[1.02] bg-[#0A0A0A] border border-gray-800 hover:border-gray-600"
    >
      {/* 3D scene — rendered via the shared Canvas using View scissoring.
          The View is only mounted when the card is fully within the scroll
          container's visible area, preventing stars from bleeding outside.
          Bottom inset keeps stars clear of the title bar. */}
      <div className="absolute top-0 left-0 right-0 bottom-[18px] sm:bottom-[40px] md:bottom-[46px]">
        {showStars ? (
          <View className="w-full h-full">
            <PerspectiveCamera
              makeDefault
              position={[0, 0, MINI_GALAXY_CONFIG.CAMERA_DISTANCE]}
              fov={50}
            />
            <MiniStarField points={points} themeColor={themeColor} />
          </View>
        ) : error ? (
          <div className="w-full h-full flex items-center justify-center bg-[#0A0A0A] text-gray-600 text-sm">
            {error}
          </div>
        ) : isLoading ? (
          <div className="w-full h-full flex items-center justify-center bg-[#0A0A0A]">
            <div className="w-6 h-6 border-2 border-gray-700 border-t-white rounded-full animate-spin" />
          </div>
        ) : null}
      </div>

      
      {/* Hover overlay - subtle white glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/5" />
      
      {/* Top stripe - subtle dark bar with arrow icon */}
      <div className="absolute top-0 left-0 right-0 bg-black/60 px-3 py-1.5 border-b border-gray-800 flex items-center justify-end">
        <ArrowUpRight className="w-4 h-4 text-gray-400" />
      </div>
      
      {/* Title bar - solid black tab with title + subtitle */}
      {displayTitle && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/95 px-2 sm:px-3 sm:py-2.5 border-t border-gray-800 h-[36px] sm:h-auto flex flex-col justify-center sm:block">
          <p 
            className="text-gray-100 font-medium leading-tight line-clamp-2 sm:truncate sm:line-clamp-none"
            style={{ fontSize: 'clamp(0.65rem, 2.2vw, 0.875rem)' }}
          >
            {displayTitle}
          </p>
          <p className="hidden sm:block text-gray-400 text-xs truncate mt-0.5">
            {points.length} moment{points.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
};

export default FeaturedGalaxyCard;
