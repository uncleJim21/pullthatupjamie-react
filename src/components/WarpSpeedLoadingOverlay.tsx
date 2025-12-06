import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ============================================================================
// WARP SPEED CONFIGURATION
// ============================================================================
const WARP_CONFIG = {
  PARTICLE_COUNT: 400,             // Fewer particles, more sparse
  SPEED: 200,                      // Very fast movement toward camera
  SPREAD: 150,                     // Much wider spread (further away)
  PARTICLE_SIZE: 0.3,              // Smaller base size
  STREAK_LENGTH: 15,               // Length of motion blur trail
  DECELERATION_DURATION: 0.5,     // Time to slow down after loading completes (seconds)
};

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

  // Initialize particle positions as line segments (for streaks)
  const particleData = useMemo(() => {
    const positions = new Float32Array(WARP_CONFIG.PARTICLE_COUNT * 6); // 2 points per line = 6 values
    const velocities = new Float32Array(WARP_CONFIG.PARTICLE_COUNT);
    
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
    }
    
    particlePositions.current = positions;
    particleVelocities.current = velocities;
    
    return { positions, velocities };
  }, []);

  // Animate particles moving toward camera with streak effect
  useFrame(() => {
    if (!linesRef.current || !particlePositions.current || !particleVelocities.current) return;
    
    const positions = particlePositions.current;
    const velocities = particleVelocities.current;
    const speed = WARP_CONFIG.SPEED * (1 - decelerationProgress);
    
    for (let i = 0; i < WARP_CONFIG.PARTICLE_COUNT; i++) {
      const i6 = i * 6;
      
      const velocity = speed * velocities[i] * 0.016;
      
      // Move both points of the line forward
      positions[i6 + 2] += velocity;      // Start Z
      positions[i6 + 5] += velocity;      // End Z
      
      // Dynamic streak length based on speed
      const streakLength = WARP_CONFIG.STREAK_LENGTH * (1 + speed * 0.05);
      positions[i6 + 5] = positions[i6 + 2] - streakLength;
      
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
      </bufferGeometry>
      <lineBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.8 * (1 - decelerationProgress * 0.7)}
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
}

export const WarpSpeedLoadingOverlay: React.FC<WarpSpeedLoadingOverlayProps> = ({ isLoading }) => {
  const [isDecelerating, setIsDecelerating] = React.useState(false);
  const [decelerationProgress, setDecelerationProgress] = React.useState(0);
  const decelerationStartTime = React.useRef<number | null>(null);
  
  // Handle deceleration animation when loading completes
  React.useEffect(() => {
    if (!isLoading) {
      // Loading just finished - start deceleration
      setIsDecelerating(true);
      decelerationStartTime.current = null;
      setDecelerationProgress(0);
    } else {
      // Loading started - reset deceleration
      setIsDecelerating(false);
      setDecelerationProgress(0);
      decelerationStartTime.current = null;
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
      
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setIsDecelerating(false);
      }
    };
    
    animationFrameId = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isDecelerating]);

  // Hide overlay completely after deceleration is done
  if (!isLoading && !isDecelerating) {
    return null;
  }

  return (
    <div 
      className="absolute inset-0 z-50 pointer-events-none"
      style={{
        opacity: 1 - decelerationProgress,
        transition: decelerationProgress > 0 ? 'opacity 0.3s ease-out' : 'none',
      }}
    >
      <Canvas camera={{ position: [0, 0, 0], fov: 75 }}>
        <color attach="background" args={['#000000']} />
        <WarpParticles decelerationProgress={decelerationProgress} />
      </Canvas>
    </div>
  );
};

export default WarpSpeedLoadingOverlay;

