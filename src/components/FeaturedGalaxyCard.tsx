import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { fetchSharedResearchSession, fetchResearchSessionWith3D } from '../services/researchSessionShareService.ts';

// ============================================================================
// CONFIGURATION
// ============================================================================
const MINI_GALAXY_CONFIG = {
  STAR_SIZE: 0.15,
  CAMERA_DISTANCE: 8,
  ROTATION_SPEED: 0.1, // Gentle auto-rotation
  GLOW_INTENSITY: 0.8,
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
  fallbackTitle?: string; // Fallback if backend doesn't return title
  fallbackColor?: string; // Fallback if backend doesn't return brandColors
  onClick?: () => void;
}

// ============================================================================
// MINI STAR FIELD COMPONENT
// ============================================================================
const MiniStarField: React.FC<{
  points: StarPoint[];
  themeColor: string;
}> = ({ points, themeColor }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Convert hex to THREE.Color
  const color = useMemo(() => new THREE.Color(themeColor), [themeColor]);
  
  // Create geometry for all stars
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(points.length * 3);
    const colors = new Float32Array(points.length * 3);
    
    points.forEach((point, i) => {
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
      
      // Apply theme color with slight variation
      const variation = 0.8 + Math.random() * 0.4;
      colors[i * 3] = color.r * variation;
      colors[i * 3 + 1] = color.g * variation;
      colors[i * 3 + 2] = color.b * variation;
    });
    
    return { positions, colors };
  }, [points, color]);
  
  // Gentle rotation animation
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * MINI_GALAXY_CONFIG.ROTATION_SPEED;
    }
  });
  
  if (points.length === 0) return null;
  
  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={points.length}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={points.length}
            array={colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={MINI_GALAXY_CONFIG.STAR_SIZE}
          vertexColors
          transparent
          opacity={MINI_GALAXY_CONFIG.GLOW_INTENSITY}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
      
      {/* Glow layer */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={points.length}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={points.length}
            array={colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={MINI_GALAXY_CONFIG.STAR_SIZE * 2.5}
          vertexColors
          transparent
          opacity={0.3}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
};

// ============================================================================
// MAIN CARD COMPONENT
// ============================================================================
export const FeaturedGalaxyCard: React.FC<FeaturedGalaxyCardProps> = ({
  shareId,
  fallbackTitle,
  fallbackColor = '#4ECDC4',
  onClick,
}) => {
  const [points, setPoints] = useState<StarPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Live data from backend
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [themeColor, setThemeColor] = useState<string>(fallbackColor);
  
  // Fetch session data on mount
  // Two-step process: shareId → researchSessionId → 3D coordinates
  useEffect(() => {
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
          // Use first brand color, ensure it has # prefix
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
  }, [shareId]);
  
  // Use live title or fallback
  const displayTitle = sessionTitle || fallbackTitle;
  
  return (
    <div
      onClick={onClick}
      className="relative flex-shrink-0 w-44 h-44 md:w-52 md:h-52 rounded-xl overflow-hidden cursor-pointer group transition-all duration-300 hover:scale-105 hover:shadow-2xl"
      style={{
        background: `linear-gradient(135deg, ${themeColor}15 0%, #00000090 100%)`,
        border: `1px solid ${themeColor}40`,
      }}
    >
      {/* Galaxy Canvas */}
      <div className="absolute inset-0">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div 
              className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: `${themeColor}80`, borderTopColor: 'transparent' }}
            />
          </div>
        ) : error ? (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
            {error}
          </div>
        ) : (
          <Canvas
            camera={{ 
              position: [0, 0, MINI_GALAXY_CONFIG.CAMERA_DISTANCE], 
              fov: 50 
            }}
            gl={{ antialias: true, alpha: true }}
            style={{ background: 'transparent' }}
          >
            <MiniStarField points={points} themeColor={themeColor} />
          </Canvas>
        )}
      </div>
      
      {/* Hover overlay */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at center, ${themeColor}20 0%, transparent 70%)`,
        }}
      />
      
      {/* Title */}
      {displayTitle && (
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
          <p className="text-white text-sm font-medium truncate">{displayTitle}</p>
        </div>
      )}
      
      {/* Corner accent */}
      <div 
        className="absolute top-2 right-2 w-2 h-2 rounded-full opacity-60 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: themeColor }}
      />
    </div>
  );
};

export default FeaturedGalaxyCard;
