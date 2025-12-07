import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ============================================================================
// EASING FUNCTIONS
// ============================================================================
const EASING = {
  // Linear (no easing)
  linear: (t: number) => t,
  
  // Ease out (fast start, slow end) - dramatic deceleration
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  
  // Ease out exponential - very dramatic
  easeOutExpo: (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  
  // Ease out quad - moderate deceleration
  easeOutQuad: (t: number) => 1 - (1 - t) * (1 - t),
  
  // Ease out quart - strong deceleration
  easeOutQuart: (t: number) => 1 - Math.pow(1 - t, 4),
};

// ============================================================================
// WARP SPEED CONFIGURATION
// ============================================================================
const WARP_CONFIG = {
  // Particle settings
  PARTICLE_COUNT: 150,             // Number of light streaks (more sparse)
  SPEED: 800,                      // MUCH faster base speed
  SPREAD: 150,                     // Cylindrical spread radius
  STREAK_LENGTH: 35,               // Longer streaks for faster speed
  
  // Deceleration settings
  DECELERATION_DURATION: 1.0,      // How long deceleration takes (seconds)
  DECELERATION_EASING: EASING.easeOutQuart, // Easing function for deceleration
  
  // Visual effects during deceleration
  DECEL_SPEED_CURVE: true,         // Apply easing to speed changes
  DECEL_FADE_STREAKS: false,       // Don't fade - keep visible during slowdown
  DECEL_SHORTEN_STREAKS: true,     // Shorten streaks as we slow (realistic)
  DECEL_DIM_COLORS: false,         // Keep colors bright during slowdown
  
  // Deceleration intensity multipliers (higher = more dramatic)
  FADE_INTENSITY: 0,               // No fading
  SHORTEN_INTENSITY: 0.8,          // Streaks get much shorter as we slow
  DIM_INTENSITY: 0,                // No dimming
};

// Nebula-inspired color palette (from SemanticGalaxyView nebula shader)
const NEBULA_COLORS = [
  new THREE.Color(1.0, 1.0, 1.0),  // Purple

];

// ============================================================================
// WARP SPEED EFFECT COMPONENT
// ============================================================================
interface WarpParticlesProps {
  decelerationProgress: number; // 0 = full speed, 1 = stopped
}

const WarpParticles: React.FC<WarpParticlesProps> = ({ decelerationProgress }) => {
  const linesRef = useRef<THREE.LineSegments>(null);
  const particlePositions = useRef<Float32Array | null>(null);
  const particleVelocities = useRef<Float32Array | null>(null);
  const particleColors = useRef<Float32Array | null>(null);

  // Initialize particle positions as line segments (for streaks)
  const particleData = useMemo(() => {
    const positions = new Float32Array(WARP_CONFIG.PARTICLE_COUNT * 6); // 2 points per line = 6 values
    const velocities = new Float32Array(WARP_CONFIG.PARTICLE_COUNT);
    const colors = new Float32Array(WARP_CONFIG.PARTICLE_COUNT * 6); // RGB for 2 points = 6 values
    
    for (let i = 0; i < WARP_CONFIG.PARTICLE_COUNT; i++) {
      const i6 = i * 6;
      
      // Random position in cylindrical spread
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * WARP_CONFIG.SPREAD;
      
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const z = Math.random() * -400 - 100;  // Far behind camera
      
      // Start point of line
      positions[i6] = x;
      positions[i6 + 1] = y;
      positions[i6 + 2] = z;
      
      // End point of line (creates streak)
      positions[i6 + 3] = x;
      positions[i6 + 4] = y;
      positions[i6 + 5] = z - WARP_CONFIG.STREAK_LENGTH;
      
      // Random velocity variation
      velocities[i] = 0.7 + Math.random() * 0.6;
      
      // Assign random nebula color to this particle
      const color = NEBULA_COLORS[Math.floor(Math.random() * NEBULA_COLORS.length)];
      
      // Start point color (brighter)
      colors[i6] = color.r;
      colors[i6 + 1] = color.g;
      colors[i6 + 2] = color.b;
      
      // End point color (dimmer for trail effect)
      colors[i6 + 3] = color.r * 0.3;
      colors[i6 + 4] = color.g * 0.3;
      colors[i6 + 5] = color.b * 0.3;
    }
    
    particlePositions.current = positions;
    particleVelocities.current = velocities;
    particleColors.current = colors;
    
    return { positions, velocities, colors };
  }, []);

  // Animate particles moving toward camera with streak effect
  useFrame(() => {
    if (!linesRef.current || !particlePositions.current || !particleVelocities.current || !particleColors.current) return;
    
    const positions = particlePositions.current;
    const velocities = particleVelocities.current;
    const colors = particleColors.current;
    
    // Apply easing to deceleration progress if enabled
    const easedProgress = WARP_CONFIG.DECEL_SPEED_CURVE 
      ? WARP_CONFIG.DECELERATION_EASING(decelerationProgress)
      : decelerationProgress;
    
    const speed = WARP_CONFIG.SPEED * (1 - easedProgress);
    
    // Calculate visual effect multipliers based on deceleration progress
    const fadeMultiplier = WARP_CONFIG.DECEL_FADE_STREAKS 
      ? 1 - (decelerationProgress * WARP_CONFIG.FADE_INTENSITY)
      : 1;
    
    const streakMultiplier = WARP_CONFIG.DECEL_SHORTEN_STREAKS
      ? 1 - (decelerationProgress * WARP_CONFIG.SHORTEN_INTENSITY)
      : 1;
    
    const colorMultiplier = WARP_CONFIG.DECEL_DIM_COLORS
      ? 1 - (decelerationProgress * WARP_CONFIG.DIM_INTENSITY)
      : 1;
    
    for (let i = 0; i < WARP_CONFIG.PARTICLE_COUNT; i++) {
      const i6 = i * 6;
      
      const velocity = speed * velocities[i] * 0.016;
      
      // Move both points of the line forward
      positions[i6 + 2] += velocity;      // Start Z
      positions[i6 + 5] += velocity;      // End Z
      
      // Dynamic streak length based on speed and deceleration
      const baseStreakLength = WARP_CONFIG.STREAK_LENGTH * (1 + speed * 0.05);
      const finalStreakLength = baseStreakLength * streakMultiplier;
      positions[i6 + 5] = positions[i6 + 2] - finalStreakLength;
      
      // Update colors during deceleration (only if dimming is enabled)
      if (WARP_CONFIG.DECEL_DIM_COLORS && decelerationProgress > 0 && colorMultiplier < 1) {
        // Get base color index from initial setup
        const baseColorIndex = i % NEBULA_COLORS.length;
        const baseColor = NEBULA_COLORS[baseColorIndex];
        
        // Start point color (adjusted for deceleration)
        colors[i6] = baseColor.r * colorMultiplier;
        colors[i6 + 1] = baseColor.g * colorMultiplier;
        colors[i6 + 2] = baseColor.b * colorMultiplier;
        
        // End point color (dimmer trail, adjusted for deceleration)
        colors[i6 + 3] = baseColor.r * 0.3 * colorMultiplier;
        colors[i6 + 4] = baseColor.g * 0.3 * colorMultiplier;
        colors[i6 + 5] = baseColor.b * 0.3 * colorMultiplier;
      }
      
      // Reset particle when it passes the camera
      if (positions[i6 + 2] > 100) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * WARP_CONFIG.SPREAD;
        
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const z = -400;
        
        positions[i6] = x;
        positions[i6 + 1] = y;
        positions[i6 + 2] = z;
        positions[i6 + 3] = x;
        positions[i6 + 4] = y;
        positions[i6 + 5] = z - WARP_CONFIG.STREAK_LENGTH;
      }
    }
    
    linesRef.current.geometry.attributes.position.needsUpdate = true;
    if (WARP_CONFIG.DECEL_DIM_COLORS) {
      linesRef.current.geometry.attributes.color.needsUpdate = true;
    }
  });

  return (
    <lineSegments ref={linesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={WARP_CONFIG.PARTICLE_COUNT * 2}
          array={particleData.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={WARP_CONFIG.PARTICLE_COUNT * 2}
          array={particleData.colors}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.9} // Keep fully visible during deceleration
        linewidth={1}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
};

// ============================================================================
// MAIN OVERLAY COMPONENT
// ============================================================================
interface WarpSpeedLoadingOverlayProps {
  isLoading: boolean;
  onDecelerationComplete?: () => void;
}

export const WarpSpeedLoadingOverlay: React.FC<WarpSpeedLoadingOverlayProps> = ({ 
  isLoading,
  onDecelerationComplete 
}) => {
  const [isDecelerating, setIsDecelerating] = React.useState(false);
  const [decelerationProgress, setDecelerationProgress] = React.useState(0);
  const decelerationStartTime = React.useRef<number | null>(null);
  const hasCalledCallback = React.useRef(false);
  
  // Handle deceleration animation when loading completes
  React.useEffect(() => {
    if (!isLoading) {
      // Loading just finished - start deceleration
      setIsDecelerating(true);
      decelerationStartTime.current = null;
      setDecelerationProgress(0);
      hasCalledCallback.current = false;
    } else {
      // Loading started - reset deceleration
      setIsDecelerating(false);
      setDecelerationProgress(0);
      decelerationStartTime.current = null;
      hasCalledCallback.current = false;
    }
  }, [isLoading]);

  // Animate deceleration progress
  React.useEffect(() => {
    if (!isDecelerating) return;

    let animationFrameId: number;
    
    const animate = () => {
      if (decelerationStartTime.current === null) {
        decelerationStartTime.current = performance.now();
      }
      
      const elapsed = (performance.now() - decelerationStartTime.current) / 1000;
      const progress = Math.min(elapsed / WARP_CONFIG.DECELERATION_DURATION, 1);
      
      setDecelerationProgress(progress);
      
      if (progress >= 1) {
        setIsDecelerating(false);
        // Call the callback when deceleration completes
        if (onDecelerationComplete && !hasCalledCallback.current) {
          hasCalledCallback.current = true;
          onDecelerationComplete();
        }
      } else {
        animationFrameId = requestAnimationFrame(animate);
      }
    };
    
    animationFrameId = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isDecelerating, onDecelerationComplete]);

  // Hide overlay completely after deceleration is done
  if (!isLoading && !isDecelerating) {
    return null;
  }

  return (
    <div 
      className="absolute inset-0 z-[100] pointer-events-none bg-black"
      style={{
        // No opacity transition - stay fully visible until deceleration completes
        opacity: (!isLoading && !isDecelerating) ? 0 : 1,
        transition: (!isLoading && !isDecelerating) ? 'opacity 0.1s ease-out' : 'none',
      }}
    >
      {/* Canvas fills entire container */}
      <div className="absolute inset-0">
        <Canvas 
          camera={{ position: [0, 0, 0], fov: 75 }}
          style={{ width: '100%', height: '100%' }}
          resize={{ scroll: false, debounce: 0 }}
        >
          <color attach="background" args={['#000000']} />
          <WarpParticles decelerationProgress={decelerationProgress} />
        </Canvas>
      </div>
      
      {/* Centered loading text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="bg-black/80 backdrop-blur-sm border border-gray-800 rounded-lg px-8 py-4">
          <p className="text-white text-xl font-medium text-center">
            Searching moments from thousands of conversations...
          </p>
        </div>
      </div>
    </div>
  );
};

export default WarpSpeedLoadingOverlay;
