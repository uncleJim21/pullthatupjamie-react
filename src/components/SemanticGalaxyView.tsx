import React, { useState, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text } from '@react-three/drei';
import * as THREE from 'three';
import { HIERARCHY_COLORS, GALAXY_STAR_THEME, GalaxyStarTheme } from '../constants/constants.ts';
import { Calendar } from 'lucide-react';
import { formatShortDate } from '../utils/time.ts';

// ============================================================================
// ANIMATION CONFIGURATION
// ============================================================================
const BOBBING_CONFIG = {
  BOB_DURATION: 1.8,        // Duration of the bob animation in seconds
  PAUSE_DURATION: 0.0,      // Duration of the pause in seconds
  BOB_DISTANCE: 0.2,      // Vertical distance of the bob (in units)
};

// ============================================================================
// VISUAL APPEARANCE - ASTRONOMICAL DIFFRACTION SPIKES
// ============================================================================

// Nebula background shaders (ported from Jared Berghold's Shadertoy "Nebula" shader)
const NEBULA_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const NEBULA_FRAGMENT_SHADER = `
  precision highp float;

  uniform float iTime;
  uniform vec3 iResolution;
  uniform vec4 iMouse;
  varying vec2 vUv;

  const int MAX_ITER = 18;

  float field(vec3 p, float s, int iter)
  {
    float accum = s / 4.0;
    float prev = 0.0;
    float tw = 0.0;
    for (int i = 0; i < MAX_ITER; ++i) 
    {
      if (i >= iter)
      {
        break;
      }
      float mag = dot(p, p);
      p = abs(p) / mag + vec3(-0.5, -0.4, -1.487);
      float w = exp(-float(i) / 5.0);
      accum += w * exp(-9.025 * pow(abs(mag - prev), 2.2));
      tw += w;
      prev = mag;
    }
    return max(0.0, 5.2 * accum / tw - 0.65);
  }

  vec3 nrand3(vec2 co)
  {
    vec3 a = fract(cos(co.x*8.3e-3 + co.y) * vec3(1.3e5, 4.7e5, 2.9e5));
    vec3 b = fract(sin(co.x*0.3e-3 + co.y) * vec3(8.1e5, 1.0e5, 0.1e5));
    vec3 c = mix(a, b, 0.5);
    return c;
  }

  vec4 starLayer(vec2 p, float time)
  {
    vec2 seed = 1.9 * p.xy;
    seed = floor(seed * max(iResolution.x, 600.0) / 1.5);
    vec3 rnd = nrand3(seed);
    vec4 col = vec4(pow(rnd.y, 17.0));
    float mul = 10.0 * rnd.x;
    col.xyz *= sin(time * mul + mul) * 0.25 + 1.0;
    return col;
  }

  void mainImage( out vec4 fragColor, in vec2 fragCoord )
  {
    float time = iTime / (iResolution.x / 1000.0);
    
    // first layer of the kaliset fractal
    vec2 uv = 2.0 * fragCoord / iResolution.xy - 1.0;
    vec2 uvs = uv * iResolution.xy / max(iResolution.x, iResolution.y);
    vec3 p = vec3(uvs / 2.5, 0.0) + vec3(0.8, -1.3, 0.0);
    p += 0.45 * vec3(sin(time / 32.0), sin(time / 24.0), sin(time / 64.0));
    
    // adjust first layer position based on mouse movement
    p.x += mix(-0.02, 0.02, (iMouse.x / iResolution.x));
    p.y += mix(-0.02, 0.02, (iMouse.y / iResolution.y));
    
    float freqs[4];
    freqs[0] = 0.45;
    freqs[1] = 0.4;
    freqs[2] = 0.15;
    freqs[3] = 0.9;

    float t = field(p, freqs[2], 13);
    float v = (1.0 - exp((abs(uv.x) - 1.0) * 6.0)) * (1.0 - exp((abs(uv.y) - 1.0) * 6.0));
    
    // second layer of the kaliset fractal
    vec3 p2 = vec3(uvs / (4.0 + sin(time * 0.11) * 0.2 + 0.2 + sin(time * 0.15) * 0.3 + 0.4), 4.0) + vec3(2.0, -1.3, -1.0);
    p2 += 0.16 * vec3(sin(time / 32.0), sin(time / 24.0), sin(time / 64.0));
    
    // adjust second layer position based on mouse movement
    p2.x += mix(-0.01, 0.01, (iMouse.x / iResolution.x));
    p2.y += mix(-0.01, 0.01, (iMouse.y / iResolution.y));
    float t2 = field(p2, freqs[3], 18);
    vec4 c2 = mix(0.5, 0.2, v) * vec4(5.5 * t2 * t2 * t2, 2.1 * t2 * t2, 2.2 * t2 * freqs[0], t2);
    
    // add stars
    vec4 starColour = vec4(0.0);
    starColour += starLayer(p.xy, time);
    starColour += starLayer(p2.xy, time);

    const float brightness = 1.0;
    vec4 colour = mix(freqs[3] - 0.3, 1.0, v) * vec4(1.5 * freqs[2] * t * t * t, 1.2 * freqs[1] * t * t, freqs[3] * t, 1.0) + c2 + starColour;
    fragColor = vec4(brightness * colour.xyz, 1.0);
  }

  void main() {
    // Reconstruct fragCoord from vUv so the shader behaves like on Shadertoy
    vec2 fragCoord = vUv * iResolution.xy;
    vec4 fragColor;
    mainImage(fragColor, fragCoord);
    gl_FragColor = fragColor;
  }
`;

// Simple config for nebula background post-dimming
// DIM_OPACITY is a "knob" you can tune between 0 (no dimming) and ~0.7 (quite dark).
const NEBULA_CONFIG = {
  DIM_OPACITY: 0.65,
};

const STAR_VISUAL_CONFIG = {
  // Bright core
  CORE_SIZE: 0.04,
  CORE_GLOW_SIZE: 0.12,
  CORE_GLOW_OPACITY: 0.6,
  
  // Soft bleeding halo (more layers for smooth falloff)
  HALO_LAYERS: [
    { size: 0.15, opacity: 0.5 },
    { size: 0.20, opacity: 0.38 },
    { size: 0.26, opacity: 0.28 },
    { size: 0.33, opacity: 0.20 },
    { size: 0.42, opacity: 0.14 },
    { size: 0.52, opacity: 0.09 },
    { size: 0.65, opacity: 0.05 },
    { size: 0.80, opacity: 0.02 },
  ],
  
  // 4 MAIN DIFFRACTION SPIKES (like telescope)
  MAIN_SPIKES: {
    COUNT: 4,                     // Classic cross pattern
    LENGTH: 1.2,
    WIDTH: 0.008,
    OPACITY: 0.6,
    FADE_START: 0.2,              // Where the fade begins (0-1 along length)
    PULSE_AMOUNT: 0.3,            // How much they pulse/vary
    PULSE_SPEED: 0.4,
  },
  
  // MANY TINY RAYS (dozens of subtle spikes)
  TINY_RAYS: {
    COUNT: 36,                    // Many small rays
    LENGTH: 0.15,
    WIDTH: 0.003,
    OPACITY: 0.15,
    RANDOM_LENGTH_VARIANCE: 0.4,  // Some longer, some shorter
    RANDOM_OPACITY_VARIANCE: 0.5,
    PULSE_AMOUNT: 0.4,
    PULSE_SPEED: 0.8,
  },
  
  // Point lights
  ENABLE_POINT_LIGHT: true,
  LIGHT_INTENSITY: 2.0,
  LIGHT_DISTANCE: 5,
};

// Interaction configuration for stars (hit area, etc.)
const STAR_INTERACTION_CONFIG = {
  CORE_HIT_RADIUS_MULTIPLIER: 5, // Multiplier for invisible interaction sphere vs visual core
};

// Generate random tiny ray properties
const generateTinyRayProperties = (starX: number, starY: number, starZ: number) => {
  const seed = starX * 12.9898 + starY * 78.233 + starZ * 37.719;
  const random = (offset: number) => {
    const val = Math.sin(seed + offset) * 43758.5453;
    return val - Math.floor(val);
  };
  
  return Array.from({ length: STAR_VISUAL_CONFIG.TINY_RAYS.COUNT }).map((_, i) => ({
    angle: (i / STAR_VISUAL_CONFIG.TINY_RAYS.COUNT) * Math.PI * 2 + random(i) * 0.3,
    length: STAR_VISUAL_CONFIG.TINY_RAYS.LENGTH * (
      1 - STAR_VISUAL_CONFIG.TINY_RAYS.RANDOM_LENGTH_VARIANCE +
      random(i * 2) * STAR_VISUAL_CONFIG.TINY_RAYS.RANDOM_LENGTH_VARIANCE * 2
    ),
    opacity: STAR_VISUAL_CONFIG.TINY_RAYS.OPACITY * (
      1 - STAR_VISUAL_CONFIG.TINY_RAYS.RANDOM_OPACITY_VARIANCE +
      random(i * 3) * STAR_VISUAL_CONFIG.TINY_RAYS.RANDOM_OPACITY_VARIANCE * 2
    ),
    pulseOffset: random(i * 4) * Math.PI * 2,
  }));
};
// ============================================================================

interface QuoteResult {
  shareLink: string;
  shareUrl: string;
  listenLink: string;
  quote: string;
  episode: string;
  creator: string;
  audioUrl: string;
  episodeImage: string;
  date: string;
  similarity: {
    combined: number;
    vector: number;
  };
  timeContext: {
    start_time: number;
    end_time: number;
  };
  hierarchyLevel: 'feed' | 'episode' | 'chapter' | 'paragraph';
  coordinates3d: {
    x: number;
    y: number;
    z: number;
  };
}

interface SemanticGalaxyViewProps {
  results: QuoteResult[];
  onStarClick: (result: QuoteResult) => void;
  selectedStarId: string | null;
  axisLabels?: {
    center?: string;
    xPositive?: string;
    xNegative?: string;
    yPositive?: string;
    yNegative?: string;
    zPositive?: string;
    zNegative?: string;
  } | null;
}

// Convert hierarchy level to color
const getHierarchyColor = (level: string): string => {
  switch (level) {
    case 'feed':
      return HIERARCHY_COLORS.FEED;
    case 'episode':
      return HIERARCHY_COLORS.EPISODE;
    case 'chapter':
      return HIERARCHY_COLORS.CHAPTER;
    case 'paragraph':
      return HIERARCHY_COLORS.PARAGRAPH;
    default:
      return HIERARCHY_COLORS.PARAGRAPH;
  }
};

// Individual Star component
interface StarProps {
  result: QuoteResult;
  isSelected: boolean;
  isNearSelected: boolean;
  onClick: () => void;
  onHover: (result: QuoteResult | null) => void;
}

// Component to draw lines connecting results from the same episode
interface EpisodeConnectionsProps {
  results: QuoteResult[];
}

// Component to display axis labels in 3D space
interface AxisLabelsProps {
  axisLabels: {
    center?: string;
    xPositive?: string;
    xNegative?: string;
    yPositive?: string;
    yNegative?: string;
    zPositive?: string;
    zNegative?: string;
  };
}

// Nebula background component rendered as a full-screen quad that follows the camera
const NebulaBackground: React.FC = () => {
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const { camera } = useThree();

  useFrame((state) => {
    if (!materialRef.current || !groupRef.current) return;

    const { width, height } = state.size;

    // Update shader uniforms
    materialRef.current.uniforms.iTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.iResolution.value.set(width, height, 1.0);

    // Map R3F normalized pointer (-1..1) to pixel coordinates for iMouse
    const pointer = state.pointer;
    const mouseX = (pointer.x * 0.5 + 0.5) * width;
    const mouseY = (pointer.y * -0.5 + 0.5) * height;
    materialRef.current.uniforms.iMouse.value.set(mouseX, mouseY, 0.0, 0.0);

    // Position the quad in front of the camera and match its orientation
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    const distance = 30; // distance in front of the camera

    const direction = new THREE.Vector3();
    perspectiveCamera.getWorldDirection(direction);

    const position = new THREE.Vector3()
      .copy(perspectiveCamera.position)
      .add(direction.multiplyScalar(distance));

    groupRef.current.position.copy(position);
    groupRef.current.quaternion.copy(perspectiveCamera.quaternion);

    // Scale the quad so it fully covers the view frustum at this distance
    const fov = THREE.MathUtils.degToRad(perspectiveCamera.fov);
    const heightAtDistance = 2 * Math.tan(fov / 2) * distance;
    const widthAtDistance = heightAtDistance * perspectiveCamera.aspect;
    groupRef.current.scale.set(widthAtDistance, heightAtDistance, 1);
  });

  return (
    <group ref={groupRef} renderOrder={-1}>
      {/* Nebula shader layer */}
      <mesh>
        <planeGeometry args={[1, 1, 1, 1]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={NEBULA_VERTEX_SHADER}
          fragmentShader={NEBULA_FRAGMENT_SHADER}
          uniforms={{
            iTime: { value: 0 },
            iResolution: { value: new THREE.Vector3(1, 1, 1.0) },
            iMouse: { value: new THREE.Vector4(0, 0, 0, 0) },
          }}
          depthWrite={false}
          depthTest={false}
          transparent={false}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Configurable dimming overlay (translucent black) */}
      {NEBULA_CONFIG.DIM_OPACITY > 0 && (
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[1, 1, 1, 1]} />
          <meshBasicMaterial
            color="black"
            transparent
            opacity={NEBULA_CONFIG.DIM_OPACITY}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
      )}
    </group>
  );
};

interface AxisLabelWithBackgroundProps {
  position: [number, number, number];
  label: string;
}

const AxisLabelWithBackground: React.FC<AxisLabelWithBackgroundProps> = ({ position, label }) => {
  const [bgSize, setBgSize] = useState<{ width: number; height: number }>({
    width: 3,
    height: 1,
  });

  const handleSync = (text: any) => {
    if (!text?.geometry?.boundingBox) return;

    const boundingBox = text.geometry.boundingBox as THREE.Box3;
    const width = boundingBox.max.x - boundingBox.min.x;
    const height = boundingBox.max.y - boundingBox.min.y;

    const paddingX = 0.6;
    const paddingY = 0.3;

    const newWidth = width + paddingX;
    const newHeight = height + paddingY;

    // Avoid unnecessary state updates every frame
    if (
      Math.abs(newWidth - bgSize.width) > 0.01 ||
      Math.abs(newHeight - bgSize.height) > 0.01
    ) {
      setBgSize({ width: newWidth, height: newHeight });
    }
  };

  return (
    <group position={position}>
      {/* Background quad for label readability */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[bgSize.width, bgSize.height]} />
        <meshBasicMaterial
          color="black"
          opacity={0.6}
          transparent
          depthWrite={false}
        />
      </mesh>

      <Text
        fontSize={0.5}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
        onSync={handleSync}
      >
        {label}
      </Text>
    </group>
  );
};

const AxisLabels: React.FC<AxisLabelsProps> = ({ axisLabels }) => {
  const labelPositions = {
    center: [0, 0, 0],
    xPositive: [10, 0, 0],
    xNegative: [-10, 0, 0],
    yPositive: [0, 10, 0],
    yNegative: [0, -10, 0],
    zPositive: [0, 0, 10],
    zNegative: [0, 0, -10],
  };

  return (
    <>
      {Object.entries(axisLabels).map(([axis, label]) => {
        if (!label) return null;
        const position = labelPositions[axis as keyof typeof labelPositions];
        
        return (
          <AxisLabelWithBackground
            key={axis}
            position={position as [number, number, number]}
            label={label}
          />
        );
      })}
    </>
  );
};

const EpisodeConnections: React.FC<EpisodeConnectionsProps> = ({ results }) => {
  const lineGeometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    
    // Create lines between all pairs of points in this episode
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const start = results[i].coordinates3d;
        const end = results[j].coordinates3d;
        
        points.push(
          new THREE.Vector3(start.x * 10, start.y * 10, start.z * 10),
          new THREE.Vector3(end.x * 10, end.y * 10, end.z * 10)
        );
      }
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [results]);

  return (
    <lineSegments geometry={lineGeometry}>
      <lineBasicMaterial 
        color="#444444" 
        transparent 
        opacity={0.2}
        linewidth={1}
      />
    </lineSegments>
  );
};

const Star: React.FC<StarProps> = ({ result, isSelected, isNearSelected, onClick, onHover }) => {
  const groupRef = useRef<THREE.Group>(null);
  const mainSpikeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const [hovered, setHovered] = useState(false);
  
  // Generate unique tiny ray properties for this star
  const tinyRayProps = useMemo(
    () => generateTinyRayProperties(result.coordinates3d.x, result.coordinates3d.y, result.coordinates3d.z),
    [result.coordinates3d.x, result.coordinates3d.y, result.coordinates3d.z]
  );

  // Animation: pulsing spikes that vary over time
  useFrame((state) => {
    if (!groupRef.current) return;
    
    const time = state.clock.elapsedTime;
    
    // Bobbing for selected
    let bobOffset = 0;
    if (isSelected) {
      const cycleTime = BOBBING_CONFIG.BOB_DURATION + BOBBING_CONFIG.PAUSE_DURATION;
      const timeInCycle = time % cycleTime;
      if (timeInCycle < BOBBING_CONFIG.BOB_DURATION) {
        bobOffset = Math.sin(timeInCycle * Math.PI / (BOBBING_CONFIG.BOB_DURATION / 2)) * BOBBING_CONFIG.BOB_DISTANCE;
      }
    }
    
    groupRef.current.position.setY(result.coordinates3d.y * 10 + bobOffset);
    
    const baseScale = isSelected ? 1.8 : hovered ? 1.4 : 1;
    groupRef.current.scale.setScalar(baseScale);
    
    // Animate main spikes - each pulses independently
    mainSpikeRefs.current.forEach((spike, i) => {
      if (spike) {
        const pulsePhase = time * STAR_VISUAL_CONFIG.MAIN_SPIKES.PULSE_SPEED + i * Math.PI * 0.5;
        const pulse = Math.sin(pulsePhase) * STAR_VISUAL_CONFIG.MAIN_SPIKES.PULSE_AMOUNT;
        spike.scale.setZ(1 + pulse);
        
        const material = spike.material as THREE.MeshBasicMaterial;
        const intensityMult = isSelected ? 1.5 : hovered ? 1.2 : isNearSelected ? 0.6 : 1;
        material.opacity = STAR_VISUAL_CONFIG.MAIN_SPIKES.OPACITY * intensityMult * (0.8 + pulse * 0.2);
      }
    });
  });

  const color = getHierarchyColor(result.hierarchyLevel);
  const intensityMultiplier = isSelected ? 1.5 : hovered ? 1.2 : isNearSelected ? 0.6 : 1;

  return (
    <group 
      ref={groupRef}
      position={[result.coordinates3d.x * 10, result.coordinates3d.y * 10, result.coordinates3d.z * 10]}
    >
      {/* Point Light */}
      {STAR_VISUAL_CONFIG.ENABLE_POINT_LIGHT && (isSelected || hovered) && (
        <pointLight
          color={color}
          intensity={STAR_VISUAL_CONFIG.LIGHT_INTENSITY * intensityMultiplier}
          distance={STAR_VISUAL_CONFIG.LIGHT_DISTANCE}
          decay={2}
        />
      )}
      
      {/* Invisible interaction sphere (larger hit area for hover/click) */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHover(result);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          onHover(null);
          document.body.style.cursor = 'auto';
        }}
      >
        <sphereGeometry
          args={[
            STAR_VISUAL_CONFIG.CORE_SIZE * STAR_INTERACTION_CONFIG.CORE_HIT_RADIUS_MULTIPLIER,
            16,
            16,
          ]}
        />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Bright Core */}
      <mesh>
        <sphereGeometry args={[STAR_VISUAL_CONFIG.CORE_SIZE, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      
      {/* Core Glow */}
      <mesh>
        <sphereGeometry args={[STAR_VISUAL_CONFIG.CORE_GLOW_SIZE, 16, 16]} />
        <meshBasicMaterial
          color={color}
          opacity={STAR_VISUAL_CONFIG.CORE_GLOW_OPACITY * intensityMultiplier}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      
      {/* Soft Halos */}
      {STAR_VISUAL_CONFIG.HALO_LAYERS.map((layer, index) => (
        <mesh key={`halo-${index}`}>
          <sphereGeometry args={[layer.size, 16, 16]} />
          <meshBasicMaterial
            color={color}
            opacity={layer.opacity * intensityMultiplier}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      
      {/* 4 MAIN DIFFRACTION SPIKES (telescope cross pattern) */}
      {Array.from({ length: STAR_VISUAL_CONFIG.MAIN_SPIKES.COUNT }).map((_, i) => {
        const angle = (i / STAR_VISUAL_CONFIG.MAIN_SPIKES.COUNT) * Math.PI * 2;
        
        return (
          <mesh
            key={`main-spike-${i}`}
            ref={el => mainSpikeRefs.current[i] = el}
            rotation={[0, 0, angle]}  // Rotate to point outward at this angle
          >
            <boxGeometry args={[
              STAR_VISUAL_CONFIG.MAIN_SPIKES.LENGTH,  // Extend along X
              STAR_VISUAL_CONFIG.MAIN_SPIKES.WIDTH,
              STAR_VISUAL_CONFIG.MAIN_SPIKES.WIDTH,
            ]} />
            <meshBasicMaterial
              color={color}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}
      
      {/* MANY TINY RAYS (subtle spikes around core) */}
      {tinyRayProps.map((ray, i) => {
        return (
          <mesh
            key={`tiny-ray-${i}`}
            rotation={[0, 0, ray.angle]}  // Rotate to point outward at this angle
          >
            <boxGeometry args={[
              ray.length,  // Extend along X
              STAR_VISUAL_CONFIG.TINY_RAYS.WIDTH,
              STAR_VISUAL_CONFIG.TINY_RAYS.WIDTH,
            ]} />
            <meshBasicMaterial
              color={color}
              opacity={ray.opacity * intensityMultiplier}
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

// Camera Reset Button
const CameraResetButton: React.FC<{ onReset: () => void }> = ({ onReset }) => {
  return (
    <button
      onClick={onReset}
      className="absolute top-4 left-4 px-3 py-2 bg-black/80 backdrop-blur-sm text-white rounded-lg border border-gray-700 hover:bg-black/90 transition-colors text-sm z-10"
    >
      Reset Camera
    </button>
  );
};

// Label Axes Toggle Button
const LabelAxesButton: React.FC<{ enabled: boolean; onToggle: () => void }> = ({ enabled, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className={`absolute top-16 left-4 px-3 py-2 backdrop-blur-sm text-white rounded-lg border transition-colors text-sm z-10 flex items-center gap-2 ${
        enabled 
          ? 'bg-white/20 border-white/40 hover:bg-white/30' 
          : 'bg-black/80 border-gray-700 hover:bg-black/90'
      }`}
    >
      {enabled && <span className="text-white font-bold">✓</span>}
      <span>Label Axes</span>
    </button>
  );
};

// Auto-play on star click toggle button
const AutoPlayButton: React.FC<{ enabled: boolean; onToggle: () => void }> = ({ enabled, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className={`absolute top-28 left-4 px-3 py-2 backdrop-blur-sm text-white rounded-lg border transition-colors text-sm z-10 flex items-center gap-2 ${
        enabled 
          ? 'bg-white/20 border-white/40 hover:bg-white/30' 
          : 'bg-black/80 border-gray-700 hover:bg-black/90'
      }`}
    >
      {enabled && <span className="text-white font-bold">✓</span>}
      <span>Auto-Play</span>
    </button>
  );
};

// Minimap component
const Minimap: React.FC<{ results: QuoteResult[]; selectedStarId: string | null }> = ({ results, selectedStarId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw points
    results.forEach((result) => {
      const x = ((result.coordinates3d.x + 1) / 2) * canvas.width;
      const y = ((result.coordinates3d.z + 1) / 2) * canvas.height;

      const isSelected = result.shareLink === selectedStarId;
      const color = getHierarchyColor(result.hierarchyLevel);

      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 4 : 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }, [results, selectedStarId]);

  return (
    <div className="absolute bottom-4 right-4 border border-gray-700 rounded-lg overflow-hidden z-10">
      <canvas
        ref={canvasRef}
        width={150}
        height={150}
        className="block"
      />
    </div>
  );
};

// Hover preview component
interface HoverPreviewProps {
  result: QuoteResult | null;
  position: { x: number; y: number };
}

const HoverPreview: React.FC<HoverPreviewProps> = ({ result, position }) => {
  if (!result) return null;

  const hierarchyColor = getHierarchyColor(result.hierarchyLevel);

  return (
    <div
      className="fixed pointer-events-none z-50"
      style={{
        left: position.x + 20,
        top: position.y + 20,
      }}
    >
      <div className="bg-black/95 backdrop-blur-sm border border-gray-700 rounded-lg p-3 max-w-xs shadow-xl">
        <div className="flex items-start gap-3">
          <img
            src={result.episodeImage}
            alt={result.episode}
            className="w-16 h-16 rounded object-cover flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: hierarchyColor,
                  boxShadow: `0 0 8px ${hierarchyColor}`,
                }}
              />
              <span className="text-xs text-gray-500 uppercase">{result.hierarchyLevel}</span>
            </div>
            <h3 className="text-sm font-medium text-white mb-1 line-clamp-2">{result.episode}</h3>
            <p className="text-xs text-gray-400 line-clamp-2 mb-1">{result.quote}</p>
            {result.date && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-gray-500" />
                <span className="text-xs text-gray-500">{formatShortDate(result.date)}</span>
              </div>
            )}
            <div className="text-xs text-gray-500 mt-1">
              Similarity: {(result.similarity.combined * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Scene component with stars
const GalaxyScene: React.FC<{
  results: QuoteResult[];
  selectedStarId: string | null;
  onStarClick: (result: QuoteResult) => void;
  onHover: (result: QuoteResult | null) => void;
  axisLabels?: {
    center?: string;
    xPositive?: string;
    xNegative?: string;
    yPositive?: string;
    yNegative?: string;
    zPositive?: string;
    zNegative?: string;
  } | null;
  showAxisLabels: boolean;
}> = ({ results, selectedStarId, onStarClick, onHover, axisLabels, showAxisLabels }) => {
  // Calculate which stars are near the selected one
  const nearbyStars = useMemo(() => {
    if (!selectedStarId) return new Set<string>();

    const selected = results.find(r => r.shareLink === selectedStarId);
    if (!selected) return new Set<string>();

    const nearby = new Set<string>();
    const threshold = 0.5; // Distance threshold for "nearby"

    results.forEach(result => {
      if (result.shareLink === selectedStarId) return;

      const dx = result.coordinates3d.x - selected.coordinates3d.x;
      const dy = result.coordinates3d.y - selected.coordinates3d.y;
      const dz = result.coordinates3d.z - selected.coordinates3d.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance < threshold) {
        nearby.add(result.shareLink);
      }
    });

    return nearby;
  }, [results, selectedStarId]);

  // Group results by episode
  const episodeGroups = useMemo(() => {
    const groups = new Map<string, QuoteResult[]>();
    
    results.forEach(result => {
      const episodeKey = result.episode;
      if (!groups.has(episodeKey)) {
        groups.set(episodeKey, []);
      }
      groups.get(episodeKey)!.push(result);
    });
    
    return groups;
  }, [results]);

  return (
    <>
      {/* Nebula background */}
      <NebulaBackground />

      {/* Ambient light */}
      <ambientLight intensity={0.3} />
      
      {/* Point light at origin */}
      <pointLight position={[0, 0, 0]} intensity={0.5} />

      {/* Axis Labels */}
      {showAxisLabels && axisLabels && (
        <AxisLabels axisLabels={axisLabels} />
      )}

      {/* Episode Connection Lines */}
      {Array.from(episodeGroups.values()).map((episodeResults, groupIndex) => {
        if (episodeResults.length < 2) return null; // Skip if only one result in episode
        
        return (
          <EpisodeConnections
            key={`episode-${groupIndex}`}
            results={episodeResults}
          />
        );
      })}

      {/* Stars */}
      {results.map((result) => (
        <Star
          key={result.shareLink}
          result={result}
          isSelected={result.shareLink === selectedStarId}
          isNearSelected={nearbyStars.has(result.shareLink)}
          onClick={() => onStarClick(result)}
          onHover={onHover}
        />
      ))}
    </>
  );
};

// Main component
export const SemanticGalaxyView: React.FC<SemanticGalaxyViewProps> = ({
  results,
  onStarClick,
  selectedStarId,
  axisLabels,
}) => {
  const [hoveredResult, setHoveredResult] = useState<QuoteResult | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  // Load showAxisLabels from userSettings in localStorage
  const [showAxisLabels, setShowAxisLabels] = useState<boolean>(() => {
    try {
      const userSettings = localStorage.getItem('userSettings');
      if (userSettings) {
        const settings = JSON.parse(userSettings);
        return settings.showAxisLabels ?? false;
      }
    } catch (e) {
      console.error('Error loading showAxisLabels from userSettings:', e);
    }
    return false;
  });
  // Load autoPlayOnStarClick from userSettings in localStorage
  const [autoPlayOnStarClick, setAutoPlayOnStarClick] = useState<boolean>(() => {
    try {
      const userSettings = localStorage.getItem('userSettings');
      if (userSettings) {
        const settings = JSON.parse(userSettings);
        return settings.autoPlayOnStarClick ?? false;
      }
    } catch (e) {
      console.error('Error loading autoPlayOnStarClick from userSettings:', e);
    }
    return false;
  });
  
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const controlsRef = useRef<any>(null);

  // Track mouse position for hover preview
  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  };

  // Reset camera to default position
  const handleResetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  // Toggle axis labels and save to userSettings
  const handleToggleAxisLabels = () => {
    const newValue = !showAxisLabels;
    setShowAxisLabels(newValue);
    
    // Save to userSettings in localStorage
    try {
      const userSettings = localStorage.getItem('userSettings');
      const settings = userSettings ? JSON.parse(userSettings) : {};
      settings.showAxisLabels = newValue;
      localStorage.setItem('userSettings', JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving showAxisLabels to userSettings:', e);
    }
  };

  return (
    <div className="relative w-full h-screen bg-black" onMouseMove={handleMouseMove}>
      {/* Camera reset button */}
      <CameraResetButton onReset={handleResetCamera} />

      {/* Label Axes button */}
      <LabelAxesButton enabled={showAxisLabels} onToggle={handleToggleAxisLabels} />

      {/* Auto-Play on star click button */}
      <AutoPlayButton
        enabled={autoPlayOnStarClick}
        onToggle={() => {
          const newValue = !autoPlayOnStarClick;
          setAutoPlayOnStarClick(newValue);
          try {
            const userSettings = localStorage.getItem('userSettings');
            const settings = userSettings ? JSON.parse(userSettings) : {};
            settings.autoPlayOnStarClick = newValue;
            localStorage.setItem('userSettings', JSON.stringify(settings));
          } catch (e) {
            console.error('Error saving autoPlayOnStarClick to userSettings:', e);
          }
        }}
      />

      {/* Minimap */}
      <Minimap results={results} selectedStarId={selectedStarId} />

      {/* Hover preview */}
      <HoverPreview result={hoveredResult} position={mousePosition} />

      {/* Stats overlay with Legend */}
      <div className="absolute top-4 right-4 px-3 py-2 bg-black/80 backdrop-blur-sm text-white rounded-lg border border-gray-700 text-sm z-10">
        <div className="flex flex-col gap-3">
          {/* Stats */}
          <div className="flex flex-col gap-1">
            <div>Results: {results.length}</div>
            {selectedStarId && <div className="text-gray-400">Star selected</div>}
          </div>
          
          {/* Legend */}
          <div className="border-t border-gray-700 pt-2">
            <div className="text-xs text-gray-400 mb-2">Hierarchy Levels</div>
            <div className="flex flex-col gap-1">
              {Object.entries(HIERARCHY_COLORS).map(([level, color]) => (
                <div key={level} className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: color,
                      boxShadow: `0 0 8px ${color}`,
                    }}
                  />
                  <span className="text-xs text-gray-300 capitalize">
                    {level.replace('_', ' ').toLowerCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas>
        <PerspectiveCamera
          ref={cameraRef}
          makeDefault
          position={[0, 5, 15]}
          fov={75}
        />
        
        <OrbitControls
          ref={controlsRef}
          enableRotate={false}
          enablePan={true}
          enableZoom={true}
          panSpeed={1}
          zoomSpeed={1}
          minDistance={5}
          maxDistance={50}
        />

        <GalaxyScene
          results={results}
          selectedStarId={selectedStarId}
          onStarClick={onStarClick}
          onHover={setHoveredResult}
          axisLabels={axisLabels || null}
          showAxisLabels={showAxisLabels}
        />
      </Canvas>
    </div>
  );
};

export default SemanticGalaxyView;

