import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text } from '@react-three/drei';
import * as THREE from 'three';
import { HIERARCHY_COLORS, printLog } from '../constants/constants.ts';
import { extractImageFromAny } from '../utils/hierarchyImageUtils.ts';
import { Calendar, RotateCcw, SlidersHorizontal, Check, Search, Plus, Layers, ChevronDown, ChevronUp, X, Podcast, Save, BrainCircuit, Share2, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { formatShortDate } from '../utils/time.ts';
import WarpSpeedLoadingOverlay from './WarpSpeedLoadingOverlay.tsx';
import { ContextMenu, ContextMenuOption } from './ContextMenu.tsx';
import { saveResearchSession, clearLocalSession, ResearchSessionItem, MAX_RESEARCH_ITEMS } from '../services/researchSessionService.ts';
import { shareCurrentSession, copyToClipboard, ShareNode } from '../services/researchSessionShareService.ts';
import ResearchAnalysisPanel from './ResearchAnalysisModal.tsx';
import ShareSessionModal from './ShareSessionModal.tsx';

// ============================================================================
// RESEARCH SESSION CONFIGURATION
// ============================================================================
const RESEARCH_SESSION_CONFIG = {
  MAX_VISIBLE_ITEMS: 3, // Maximum number of items visible before scrolling
};

// ============================================================================
// ANIMATION CONFIGURATION
// ============================================================================
const BOBBING_CONFIG = {
  BOB_DURATION: 1.8,        // Duration of the bob animation in seconds
  PAUSE_DURATION: 0.0,      // Duration of the pause in seconds
  BOB_DISTANCE: 0.2,      // Vertical distance of the bob (in units)
};

// ============================================================================
// SELECTION DIMMING CONFIGURATION
// ============================================================================
const SELECTION_CONFIG = {
  NON_SELECTED_DIM_FACTOR: 0.6, // How much to dim non-selected stars when a selection exists (0.0 = invisible, 1.0 = no dimming)
};

// ============================================================================
// WARP SPEED CONFIGURATION
// ============================================================================
const WARP_SPEED_CONFIG = {
  PARTICLE_COUNT: 300,      // Number of particles
  SPEED: 5,                 // Base speed of particles
  SPREAD: 100,              // Spread radius
  PARTICLE_SIZE: 2,         // Size of each particle
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
  DIM_OPACITY: 0.5,
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
  CORE_HIT_RADIUS_MULTIPLIER: 10, // Multiplier for invisible interaction sphere vs visual core
};

// Camera intro animation configuration
const CAMERA_ANIMATION_CONFIG = {
  startDelay: 1.5,             // seconds to wait before starting animation (configurable for testing)
  duration: 0.25,               // seconds (longer to see the zoom effect)
  fromAngle: Math.PI,          // 180 degrees
  toAngle: 0,                  // 0 degrees (forward)
  fromDistanceFactor: 0.3,    // start closer (easier to see zoom out)
  toDistanceFactor: 1.35,      // zoom out 50% more (was 0.9, now 1.35)
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

interface CameraAnimationState {
  startedAt?: number;
  duration: number;
  fromAngle: number;
  toAngle: number;
  fromDistance: number;
  toDistance: number;
  baseYRatio: number;
  completed?: boolean;
}

interface QuoteResult {
  shareLink: string;
  shareUrl: string;
  listenLink?: string;

  // Core textual fields
  quote: string;
  summary?: string;
  headline?: string;

  // Episode / creator context
  episode: string;
  creator: string;
  audioUrl: string;
  episodeImage?: string;
  date: string;
  published?: string | null;

  // Tooltip abstraction (preferred by UI)
  tooltipTitle?: string;
  tooltipSubtitle?: string;
  tooltipImage?: string;

  similarity: {
    combined: number;
    vector: number;
  };
  timeContext: {
    start_time: number | null;
    end_time: number | null;
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
  isLoading?: boolean;
  onDecelerationComplete?: () => void;
  query?: string;
  onAddToResearch?: (result: QuoteResult) => void;
  researchSessionShareLinks?: string[];
  researchSessionItems?: ResearchSessionItem[];
  onRemoveFromResearch?: (shareLink: string) => void;
  onClearResearch?: () => void;
  showResearchToast?: boolean;
  isContextPanelOpen?: boolean;
  onCloseContextPanel?: () => void;
  onOpenAnalysisPanel?: () => void;
  sharedSessionTitle?: string | null;
  hideStats?: boolean; // Hide the stats/legend panel
  compactStats?: boolean; // When true, top-right overlay shows only a minimal search summary
  hideOptions?: boolean; // Hide the left-side Options menu (used for embed mode)
  nebulaDimOpacity?: number; // Configurable nebula dim opacity (defaults to NEBULA_CONFIG.DIM_OPACITY)
  brandImage?: string; // Brand logo image URL for embed mode
  brandColors?: string[]; // Brand colors for embed mode (stars will use first color)
  // When true, disable all touch/mouse interactions for the canvas (useful when a mobile bottom-sheet is expanded).
  disableInteractions?: boolean;
  // Compact height mode: hide non-essential UI (reset button, title) for very short viewports
  isCompactHeight?: boolean;
}

// Transform color to compensate for additive blending brightening
// This darkens/saturates colors so they look correct after being brightened
const transformColorForBlending = (hexColor: string, factor: number = 0.5): string => {
  // Parse hex color
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Darken by multiplying each channel by the factor
  const newR = Math.round(r * factor);
  const newG = Math.round(g * factor);
  const newB = Math.round(b * factor);
  
  // Convert back to hex
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
};

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
  hasSelection: boolean;
  onClick: () => void;
  onRightClick: (event: any) => void;
  onHover: (result: QuoteResult | null) => void;
  overrideColor?: string; // Override color for brand mode
}

// Component to draw lines connecting results from the same episode, chapter, or feed
interface HierarchyConnectionsProps {
  results: QuoteResult[];
  hierarchyLevel: 'feed' | 'episode' | 'chapter';
  selectedStarId: string | null;
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
const NebulaBackground: React.FC<{ dimOpacity?: number }> = ({ dimOpacity = NEBULA_CONFIG.DIM_OPACITY }) => {
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
      {dimOpacity > 0 && (
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[1, 1, 1, 1]} />
          <meshBasicMaterial
            color="black"
            transparent
            opacity={dimOpacity}
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
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  // Make the label always face the camera (billboarding)
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.quaternion.copy(camera.quaternion);
    }
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
    <group ref={groupRef} position={position}>
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

// Configuration for glowing connection threads (diffuse, soft aesthetic)
const BASE_THREAD_OPACITY = 0.06
const THREAD_CONFIG = {
  CORE_RADIUS: 0.008,
  CORE_OPACITY: 0.3,
  GLOW_LAYERS: [
    { radius: 0.03, opacity: BASE_THREAD_OPACITY / (1 + 3.2 * Math.log(1 + 0.03 * 10)) },
    { radius: 0.06, opacity: BASE_THREAD_OPACITY / (1 + 3.2 * Math.log(1 + 0.06 * 10)) },
    { radius: 0.10, opacity: BASE_THREAD_OPACITY / (1 + 3.2 * Math.log(1 + 0.10 * 10)) },
    { radius: 0.15, opacity: BASE_THREAD_OPACITY / (1 + 3.2 * Math.log(1 + 0.15 * 10)) },
    { radius: 0.22, opacity: BASE_THREAD_OPACITY / (1 + 3.2 * Math.log(1 + 0.22 * 10)) },
    { radius: 0.30, opacity: BASE_THREAD_OPACITY / (1 + 3.2 * Math.log(1 + 0.30 * 10)) },
    { radius: 0.40, opacity: BASE_THREAD_OPACITY / (1 + 3.2 * Math.log(1 + 0.40 * 10)) },
    { radius: 0.52, opacity: BASE_THREAD_OPACITY / (1 + 3.2 * Math.log(1 + 0.52 * 10)) },
    { radius: 0.66, opacity: BASE_THREAD_OPACITY / (1 + 3.2 * Math.log(1 + 0.66 * 10)) },
    { radius: 0.82, opacity: BASE_THREAD_OPACITY / (1 + 3.2 * Math.log(1 + 0.82 * 10)) },
    { radius: 1.00, opacity: BASE_THREAD_OPACITY / (1 + 3.2 * Math.log(1 + 1.00 * 10)) },
  ],
};

const HierarchyConnections: React.FC<HierarchyConnectionsProps> = ({ results, hierarchyLevel, selectedStarId }) => {
  // Create individual connection pairs - only show connections involving the selected star
  const connections = useMemo(() => {
    const pairs: Array<{ start: THREE.Vector3; end: THREE.Vector3 }> = [];
    
    // If no star is selected, don't show any connections
    if (!selectedStarId) {
      return pairs;
    }
    
    // Find the selected result in this group
    const selectedIndex = results.findIndex(r => r.shareLink === selectedStarId);
    if (selectedIndex === -1) {
      return pairs; // Selected star is not in this group
    }
    
    // Only create connections between the selected star and other stars in the same group
    const selectedResult = results[selectedIndex];
    for (let j = 0; j < results.length; j++) {
      if (j === selectedIndex) continue; // Skip self
      
      const start = selectedResult.coordinates3d;
      const end = results[j].coordinates3d;
      
      pairs.push({
        start: new THREE.Vector3(start.x * 10, start.y * 10, start.z * 10),
        end: new THREE.Vector3(end.x * 10, end.y * 10, end.z * 10)
      });
    }
    
    return pairs;
  }, [results, selectedStarId]);

  // Get color based on hierarchy - 1 (use the color of one level below)
  // Same chapter → use paragraph color
  // Same episode → use chapter color
  // Same feed → use episode color
  const baseColor = useMemo(() => {
    switch (hierarchyLevel) {
      case 'feed':
        return HIERARCHY_COLORS.EPISODE;  // Feed connections use episode color
      case 'episode':
        return HIERARCHY_COLORS.CHAPTER;  // Episode connections use chapter color
      case 'chapter':
        return HIERARCHY_COLORS.PARAGRAPH; // Chapter connections use paragraph color
      default:
        return HIERARCHY_COLORS.CHAPTER;
    }
  }, [hierarchyLevel]);

  // Apply color transformation for additive blending (same as stars)
  const color = transformColorForBlending(baseColor, 0.65);

  return (
    <group>
      {connections.map((connection, connIndex) => {
        const direction = new THREE.Vector3().subVectors(connection.end, connection.start);
        const length = direction.length();
        const midpoint = new THREE.Vector3().addVectors(connection.start, connection.end).multiplyScalar(0.5);
        
        // Calculate orientation
        const axis = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
          axis,
          direction.clone().normalize()
        );

        return (
          <group key={connIndex} position={midpoint} quaternion={quaternion}>
            {/* Core thread - soft center */}
            <mesh>
              <cylinderGeometry args={[THREAD_CONFIG.CORE_RADIUS, THREAD_CONFIG.CORE_RADIUS, length, 8]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={THREAD_CONFIG.CORE_OPACITY}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>

            {/* Multiple glow layers - soft halo (same technique as stars) */}
            {THREAD_CONFIG.GLOW_LAYERS.map((layer, layerIndex) => (
              <mesh key={layerIndex}>
                <cylinderGeometry args={[layer.radius, layer.radius, length, 8]} />
                <meshBasicMaterial
                  color={color}
                  transparent
                  opacity={layer.opacity}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
};

const Star: React.FC<StarProps> = ({ result, isSelected, isNearSelected, hasSelection, onClick, onRightClick, onHover, overrideColor }) => {
  const groupRef = useRef<THREE.Group>(null);
  const mainSpikeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const [hovered, setHovered] = useState(false);
  const longPressTimeoutRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  
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

  // Use override color if provided (for brand mode), otherwise use hierarchy color
  const baseColor = overrideColor || getHierarchyColor(result.hierarchyLevel);
  
  // Apply transform to compensate for additive blending brightening
  // Use a moderate darkening factor (0.65) to compensate for both the intensity multiplier and layer stacking
  const color = transformColorForBlending(baseColor, 0.65);

  // Make the selected star brighter and dim all others when a selection exists.
  const baseIntensity =
    isSelected ? 1.8 : hovered ? 1.3 : isNearSelected ? 0.8 : 1;
  const dimFactor = hasSelection && !isSelected ? SELECTION_CONFIG.NON_SELECTED_DIM_FACTOR : 1;
  const intensityMultiplier = baseIntensity * dimFactor;

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
          if (longPressTriggeredRef.current) {
            // Long-press already handled the interaction (open context menu).
            longPressTriggeredRef.current = false;
            return;
          }
          onClick();
        }}
        onContextMenu={(e) => {
          e.stopPropagation();
          onRightClick(e as any);
        }}
        onPointerDown={(e) => {
          // Touch devices don't have a right-click; emulate with long-press.
          // R3F passes through PointerEvent semantics on the nativeEvent.
          const native = e.nativeEvent as PointerEvent;
          if (native?.pointerType !== 'touch') return;

          e.stopPropagation();
          longPressTriggeredRef.current = false;

          if (longPressTimeoutRef.current) {
            window.clearTimeout(longPressTimeoutRef.current);
          }

          const clientX = (native as any).clientX ?? 0;
          const clientY = (native as any).clientY ?? 0;

          longPressTimeoutRef.current = window.setTimeout(() => {
            longPressTriggeredRef.current = true;
            onRightClick({ clientX, clientY, nativeEvent: native } as any);
          }, 520);
        }}
        onPointerUp={() => {
          if (longPressTimeoutRef.current) {
            window.clearTimeout(longPressTimeoutRef.current);
            longPressTimeoutRef.current = null;
          }
        }}
        onPointerOut={() => {
          if (longPressTimeoutRef.current) {
            window.clearTimeout(longPressTimeoutRef.current);
            longPressTimeoutRef.current = null;
          }
          setHovered(false);
          onHover(null);
          document.body.style.cursor = 'auto';
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHover(result);
          document.body.style.cursor = 'pointer';
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

// Component responsible for animating the camera on mount / results change
const AnimatedCamera: React.FC<{
  cameraRef: React.RefObject<THREE.PerspectiveCamera>;
  controlsRef: React.RefObject<any>;
  animationRef: React.MutableRefObject<CameraAnimationState | null>;
  isAnimating: boolean;
  setIsAnimating: (value: boolean) => void;
}> = ({ cameraRef, controlsRef, animationRef, isAnimating, setIsAnimating }) => {
  const hasCompletedRef = useRef(false);
  
  useFrame((state) => {
    if (!isAnimating || hasCompletedRef.current) return;
    const cam = cameraRef.current;
    const controls = controlsRef.current;

    if (!cam) return;

    // Lazily initialize animation parameters once the camera is ready
    if (!animationRef.current || animationRef.current.completed) {
      const baseDistance =
        Math.sqrt(
          cam.position.x * cam.position.x +
            cam.position.y * cam.position.y +
            cam.position.z * cam.position.z,
        ) || 15;

      const baseYRatio =
        baseDistance !== 0 ? cam.position.y / baseDistance : 0.33;

      animationRef.current = {
        duration: CAMERA_ANIMATION_CONFIG.duration,
        fromAngle: CAMERA_ANIMATION_CONFIG.fromAngle,
        toAngle: CAMERA_ANIMATION_CONFIG.toAngle,
        fromDistance:
          baseDistance * CAMERA_ANIMATION_CONFIG.fromDistanceFactor,
        toDistance: baseDistance * CAMERA_ANIMATION_CONFIG.toDistanceFactor,
        baseYRatio,
      };
    }

    const anim = animationRef.current;
    if (!anim) return;

    // Lazily set start time in scene time coordinates
    if (anim.startedAt === undefined) {
      anim.startedAt = state.clock.getElapsedTime();
    }

    const elapsed = state.clock.getElapsedTime() - anim.startedAt;
    
    // Apply start delay before beginning animation
    if (elapsed < CAMERA_ANIMATION_CONFIG.startDelay) {
      // During delay, keep camera at starting position
      const angle = anim.fromAngle;
      const distance = anim.fromDistance;
      const y = distance * anim.baseYRatio;
      const x = distance * Math.sin(angle);
      const z = distance * Math.cos(angle);
      cam.position.set(x, y, z);
      cam.lookAt(0, 0, 0);
      if (controls && controls.target) {
        controls.target.set(0, 0, 0);
      }
      return;
    }
    
    // After delay, run the animation
    const animationElapsed = elapsed - CAMERA_ANIMATION_CONFIG.startDelay;
    const tRaw = animationElapsed / anim.duration;
    const t = Math.min(1, Math.max(0, tRaw));

    const angle = anim.fromAngle + (anim.toAngle - anim.fromAngle) * t;
    const distance = anim.fromDistance + (anim.toDistance - anim.fromDistance) * t;

    const y = distance * anim.baseYRatio;
    const x = distance * Math.sin(angle);
    const z = distance * Math.cos(angle);

    cam.position.set(x, y, z);
    cam.lookAt(0, 0, 0);

    if (controls && controls.target) {
      controls.target.set(0, 0, 0);
      controls.update();
    }

    if (t >= 1) {
      // NUCLEAR OPTION: Stop useFrame from running entirely
      hasCompletedRef.current = true;
      
      setIsAnimating(false);
    }
  });

  return null;
};

// Hover preview component
interface HoverPreviewProps {
  result: QuoteResult | null;
  position: { x: number; y: number };
}

const HoverPreview: React.FC<HoverPreviewProps> = ({ result, position }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  
  // Reset image states when result changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [result]);

  // Adjust position to keep preview on screen
  useEffect(() => {
    if (!previewRef.current) return;

    const preview = previewRef.current;
    const rect = preview.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let newX = position.x + 20;
    let newY = position.y + 20;

    // Check if preview goes off right edge
    if (newX + rect.width > viewportWidth) {
      // Try positioning to the left of cursor
      newX = position.x - rect.width - 20;
      // If still off screen (left edge), clamp to right edge
      if (newX < 0) {
        newX = viewportWidth - rect.width - 10;
      }
    }

    // Check if preview goes off bottom edge
    if (newY + rect.height > viewportHeight) {
      // Position above cursor
      newY = position.y - rect.height - 20;
      // If still off screen (top edge), clamp to bottom edge
      if (newY < 0) {
        newY = viewportHeight - rect.height - 10;
      }
    }

    // Ensure we don't go off left edge
    if (newX < 0) {
      newX = 10;
    }

    // Ensure we don't go off top edge
    if (newY < 0) {
      newY = 10;
    }

    setAdjustedPosition({ x: newX, y: newY });
  }, [position, result]);

  if (!result) return null;

  const hierarchyColor = getHierarchyColor(result.hierarchyLevel);

  // Derive tooltip display fields with sensible fallbacks so chapters and paragraphs
  // can share the same hover UI.
  // Use the hierarchyImageUtils helper to consistently extract images
  const tooltipImage = extractImageFromAny(result);

  // Prefer explicit tooltip title, then chapter headline, then episode title.
  const rawTitle =
    result.tooltipTitle ??
    result.headline ??
    result.episode ??
    'Unknown title';

  // Prefer explicit tooltip subtitle, then summary for chapters, then quote.
  const rawSubtitle =
    result.tooltipSubtitle ??
    result.summary ??
    result.quote ??
    'Summary not available';

  const safeTitle = rawTitle || 'Unknown title';
  const safeSubtitle = rawSubtitle || 'Summary not available';

  // Prefer ISO published date if available, otherwise use the human-readable date string.
  const dateValue = result.published ?? result.date;
  const hasDate = Boolean(dateValue && dateValue !== 'Date not provided');

  // Normalize similarity to an object
  const similarityObj =
    typeof result.similarity === 'number'
      ? { combined: result.similarity, vector: result.similarity }
      : result.similarity;

  return (
    <div
      ref={previewRef}
      className="fixed pointer-events-none z-50"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      <div className="bg-black/95 backdrop-blur-sm border border-gray-700 rounded-lg p-3 max-w-xs shadow-xl">
        <div className="flex items-start gap-3">
          {tooltipImage ? (
            <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0 relative">
              {!imageLoaded && !imageError && (
                <div className="w-full h-full bg-gray-800 animate-pulse" />
              )}
              <img
                src={tooltipImage}
                alt={safeTitle}
                className={`w-full h-full object-cover ${imageLoaded ? 'block' : 'hidden'}`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
              {imageError && (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  <Podcast className="w-8 h-8 text-gray-600" />
                </div>
              )}
            </div>
          ) : (
            <div className="w-16 h-16 rounded bg-gray-800 flex items-center justify-center flex-shrink-0">
              <Podcast className="w-8 h-8 text-gray-600" />
            </div>
          )}
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
            <h3 className="text-sm font-medium text-white mb-1 line-clamp-2">
              {safeTitle}
            </h3>
            <p className="text-xs text-gray-400 line-clamp-3 mb-1">
              {safeSubtitle}
            </p>
            {hasDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-gray-500" />
                <span className="text-xs text-gray-500">
                  {typeof dateValue === 'string'
                    ? formatShortDate(dateValue)
                    : ''}
                </span>
              </div>
            )}
            <div className="text-xs text-gray-500 mt-1">
              Similarity:{' '}
              {similarityObj && typeof similarityObj.combined === 'number'
                ? `${(similarityObj.combined * 100).toFixed(0)}%`
                : 'N/A'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Warp Speed Effect Component for Loading State
interface WarpSpeedEffectProps {
  isActive: boolean;
  decelerationProgress: number; // 0 = full speed, 1 = stopped
}

const WarpSpeedEffect: React.FC<WarpSpeedEffectProps> = ({ isActive, decelerationProgress }) => {
  const particlesRef = useRef<THREE.Points>(null);
  const particlePositions = useRef<Float32Array | null>(null);
  const particleVelocities = useRef<Float32Array | null>(null);

  // Initialize particle positions and velocities
  const particleData = useMemo(() => {
    const positions = new Float32Array(WARP_SPEED_CONFIG.PARTICLE_COUNT * 3);
    const velocities = new Float32Array(WARP_SPEED_CONFIG.PARTICLE_COUNT);
    
    for (let i = 0; i < WARP_SPEED_CONFIG.PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      
      // Random position in cylindrical spread around camera direction
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * WARP_SPEED_CONFIG.SPREAD;
      
      positions[i3] = Math.cos(angle) * radius;     // x
      positions[i3 + 1] = Math.sin(angle) * radius; // y
      positions[i3 + 2] = Math.random() * -200 - 50; // z (behind camera initially)
      
      // Random velocity for variation
      velocities[i] = 0.5 + Math.random() * 0.5;
    }
    
    particlePositions.current = positions;
    particleVelocities.current = velocities;
    
    return { positions, velocities };
  }, []);

  // Animate particles moving toward camera
  useFrame((state) => {
    if (!particlesRef.current || !particlePositions.current || !particleVelocities.current) return;
    
    const positions = particlePositions.current;
    const velocities = particleVelocities.current;
    const speed = WARP_SPEED_CONFIG.SPEED * (1 - decelerationProgress);
    
    for (let i = 0; i < WARP_SPEED_CONFIG.PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      
      // Move particle forward (positive z direction)
      positions[i3 + 2] += speed * velocities[i] * 0.016; // approximate 60fps delta
      
      // Reset particle when it passes the camera
      if (positions[i3 + 2] > 50) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * WARP_SPEED_CONFIG.SPREAD;
        
        positions[i3] = Math.cos(angle) * radius;
        positions[i3 + 1] = Math.sin(angle) * radius;
        positions[i3 + 2] = -200;
      }
    }
    
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  if (!isActive && decelerationProgress >= 1) return null;

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={WARP_SPEED_CONFIG.PARTICLE_COUNT}
          array={particleData.positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={WARP_SPEED_CONFIG.PARTICLE_SIZE}
        color="#ffffff"
        transparent
        opacity={0.8 * (1 - decelerationProgress * 0.5)}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

// Scene component with stars
const GalaxyScene: React.FC<{
  results: QuoteResult[];
  selectedStarId: string | null;
  onStarClick: (result: QuoteResult) => void;
  onStarRightClick: (result: QuoteResult, event: any) => void;
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
  isAnimatingCamera: boolean;
  nebulaDimOpacity?: number;
  brandColors?: string[];
}> = ({ results, selectedStarId, onStarClick, onStarRightClick, onHover, axisLabels, showAxisLabels, isAnimatingCamera, nebulaDimOpacity, brandColors }) => {
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

  // Group results by hierarchy levels (feed, episode, chapter)
  const hierarchyGroups = useMemo(() => {
    const feedGroups = new Map<string, QuoteResult[]>();
    const episodeGroups = new Map<string, QuoteResult[]>();
    const chapterGroups = new Map<string, QuoteResult[]>();
    
    results.forEach(result => {
      // Group by feed (using creator as feed identifier)
      const feedKey = result.creator;
      if (!feedGroups.has(feedKey)) {
        feedGroups.set(feedKey, []);
      }
      feedGroups.get(feedKey)!.push(result);
      
      // Group by episode
      const episodeKey = result.episode;
      if (!episodeGroups.has(episodeKey)) {
        episodeGroups.set(episodeKey, []);
      }
      episodeGroups.get(episodeKey)!.push(result);
      
      // Group by chapter (using headline if available, otherwise episode)
      const chapterKey = result.headline || result.episode;
      if (!chapterGroups.has(chapterKey)) {
        chapterGroups.set(chapterKey, []);
      }
      chapterGroups.get(chapterKey)!.push(result);
    });
    
    return { feedGroups, episodeGroups, chapterGroups };
  }, [results]);

  return (
    <>
      {/* Nebula background */}
      <NebulaBackground dimOpacity={nebulaDimOpacity} />

      {/* Ambient light */}
      <ambientLight intensity={0.3} />
      
      {/* Point light at origin */}
      <pointLight position={[0, 0, 0]} intensity={0.5} />

      {/* Axis Labels - Hidden during camera animation */}
      {showAxisLabels && axisLabels && !isAnimatingCamera && (
        <AxisLabels axisLabels={axisLabels} />
      )}

      {/* Hierarchy Connection Lines - Feed Level (most subtle) */}
      {Array.from(hierarchyGroups.feedGroups.values()).map((feedResults, groupIndex) => {
        if (feedResults.length < 2) return null; // Skip if only one result in feed
        
        return (
          <HierarchyConnections
            key={`feed-${groupIndex}`}
            results={feedResults}
            hierarchyLevel="feed"
            selectedStarId={selectedStarId}
          />
        );
      })}
      
      {/* Hierarchy Connection Lines - Episode Level (medium) */}
      {Array.from(hierarchyGroups.episodeGroups.values()).map((episodeResults, groupIndex) => {
        if (episodeResults.length < 2) return null; // Skip if only one result in episode
        
        return (
          <HierarchyConnections
            key={`episode-${groupIndex}`}
            results={episodeResults}
            hierarchyLevel="episode"
            selectedStarId={selectedStarId}
          />
        );
      })}
      
      {/* Hierarchy Connection Lines - Chapter Level (most visible) */}
      {Array.from(hierarchyGroups.chapterGroups.values()).map((chapterResults, groupIndex) => {
        if (chapterResults.length < 2) return null; // Skip if only one result in chapter
        
        return (
          <HierarchyConnections
            key={`chapter-${groupIndex}`}
            results={chapterResults}
            hierarchyLevel="chapter"
            selectedStarId={selectedStarId}
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
          hasSelection={Boolean(selectedStarId)}
          onClick={() => onStarClick(result)}
          onRightClick={(e) => onStarRightClick(result, e)}
          onHover={onHover}
          overrideColor={brandColors && brandColors.length > 0 ? `#${brandColors[0]}` : undefined}
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
  isLoading = false,
  onDecelerationComplete,
  query,
  onAddToResearch,
  researchSessionShareLinks = [],
  researchSessionItems = [],
  onRemoveFromResearch,
  onClearResearch,
  showResearchToast = false,
  isContextPanelOpen = false,
  onCloseContextPanel,
  onOpenAnalysisPanel,
  sharedSessionTitle = null,
  hideStats = false,
  compactStats = false,
  hideOptions = false,
  nebulaDimOpacity,
  brandImage,
  brandColors,
  disableInteractions = false,
  isCompactHeight = false,
}) => {
  const [isTouchLikePointer, setIsTouchLikePointer] = useState(false);
  const [hoveredResult, setHoveredResult] = useState<QuoteResult | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isAnimatingCamera, setIsAnimatingCamera] = useState(false);
  const [cameraAnimKey, setCameraAnimKey] = useState(0); // Force remount on results change
  const cameraAnimationRef = useRef<CameraAnimationState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasDomRef = useRef<HTMLCanvasElement | null>(null);
  const pinchRef = useRef<{
    active: boolean;
    pointers: Map<number, { x: number; y: number }>;
    startDistancePx: number;
    startCamDistance: number;
    startDir: THREE.Vector3;
    target: THREE.Vector3;
  }>({
    active: false,
    pointers: new Map(),
    startDistancePx: 0,
    startCamDistance: 0,
    startDir: new THREE.Vector3(0, 0, 1),
    target: new THREE.Vector3(0, 0, 0),
  });
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ result: QuoteResult; position: { x: number; y: number } } | null>(null);
  
  // Research session collapsed state
  const [isResearchCollapsed, setIsResearchCollapsed] = useState(true);
  
  // Options menu state
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  
  // Ensure we don't keep an "open" options menu in embed mode if this flag flips
  useEffect(() => {
    if (hideOptions) {
      setShowOptionsMenu(false);
    }
  }, [hideOptions]);
  
  // Minimap canvas ref
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Draw minimap when results or selection changes
  useEffect(() => {
    const canvas = minimapCanvasRef.current;
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
  
  // Research item hover state with delay
  const [hoveredResearchItem, setHoveredResearchItem] = useState<any | null>(null);
  const [showResearchTooltip, setShowResearchTooltip] = useState(false);
  const researchHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Save toast state
  const [saveToast, setSaveToast] = useState<{ show: boolean; type: 'success' | 'error' | 'loading'; message: string }>({
    show: false,
    type: 'success',
    message: ''
  });
  const saveToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Share toast state
  const [shareToast, setShareToast] = useState<{ show: boolean; type: 'success' | 'error' | 'loading'; message: string }>({
    show: false,
    type: 'success',
    message: ''
  });
  const shareToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  
  // Analysis modal state
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  
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

  // Detect "touch-like" environments (mobile/tablet, or desktop with coarse pointer).
  // We use this to avoid OrbitControls' 2-finger dolly/pan codepath which can crash
  // when the pointer/touch stream is interrupted (common when the page can scroll).
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mq = window.matchMedia('(pointer: coarse)');
    const update = () => setIsTouchLikePointer(Boolean(mq.matches));
    update();

    // Older Safari uses addListener/removeListener
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  // Hard-disable the problematic touch gestures in OrbitControls on touch-like pointers.
  // Keep 1-finger rotate; disable OrbitControls pinch-zoom + two-finger pan/dolly (these are the crashing paths).
  // We'll implement our own pinch-to-zoom on the canvas element (below) to re-enable zoom safely.
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;

    if (isTouchLikePointer) {
      c.enableZoom = false;
      c.enablePan = false;
      // Force two-finger gesture to rotate (0) instead of dolly/pan (3).
      // OrbitControls expects these numeric enums internally.
      c.touches = { ONE: 0, TWO: 0 };
    } else {
      c.enableZoom = true;
      c.enablePan = true;
      // Leave default touches mapping when not touch-like.
    }
  }, [isTouchLikePointer]);

  // Safe pinch-to-zoom (mobile): adjust camera distance along the OrbitControls target vector.
  // We attach native pointer listeners in capture phase so OrbitControls never sees 2-finger gestures.
  useEffect(() => {
    if (disableInteractions) return;
    const el = canvasDomRef.current;
    if (!el) return;

    const getTwo = () => {
      const pts = Array.from(pinchRef.current.pointers.values());
      if (pts.length < 2) return null;
      return [pts[0], pts[1]] as const;
    };

    const distancePx = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    const beginPinchIfReady = () => {
      if (!isTouchLikePointer) return;
      if (pinchRef.current.active) return;
      if (pinchRef.current.pointers.size < 2) return;

      const cam = cameraRef.current;
      const controls = controlsRef.current;
      if (!cam || !controls) return;

      const two = getTwo();
      if (!two) return;
      const d = distancePx(two[0], two[1]);
      if (!Number.isFinite(d) || d <= 0) return;

      const target = (controls.target?.clone?.() as THREE.Vector3) ?? new THREE.Vector3(0, 0, 0);
      const offset = cam.position.clone().sub(target);
      const startCamDistance = offset.length();
      if (!Number.isFinite(startCamDistance) || startCamDistance <= 0) return;

      pinchRef.current.active = true;
      pinchRef.current.startDistancePx = d;
      pinchRef.current.startCamDistance = startCamDistance;
      pinchRef.current.startDir = offset.normalize();
      pinchRef.current.target = target;
    };

    const updatePinch = () => {
      if (!pinchRef.current.active) return;
      if (pinchRef.current.pointers.size < 2) return;
      const cam = cameraRef.current;
      const controls = controlsRef.current;
      if (!cam || !controls) return;

      const two = getTwo();
      if (!two) return;
      const d = distancePx(two[0], two[1]);
      if (!Number.isFinite(d) || d <= 0) return;

      const scale = pinchRef.current.startDistancePx / d; // spread fingers => d bigger => scale < 1 (zoom in)
      const rawDistance = pinchRef.current.startCamDistance * scale;

      const minD = typeof controls.minDistance === 'number' ? controls.minDistance : 5;
      const maxD = typeof controls.maxDistance === 'number' ? controls.maxDistance : 50;
      const clamped = Math.max(minD, Math.min(maxD, rawDistance));

      cam.position
        .copy(pinchRef.current.target)
        .add(pinchRef.current.startDir.clone().multiplyScalar(clamped));
      controls.update?.();
    };

    const endPinchIfNeeded = () => {
      if (pinchRef.current.pointers.size < 2) {
        pinchRef.current.active = false;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      pinchRef.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Once we have 2 touches, we "own" the gesture (stop OrbitControls from seeing it).
      if (pinchRef.current.pointers.size >= 2) {
        beginPinchIfReady();
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      if (!pinchRef.current.pointers.has(e.pointerId)) return;
      pinchRef.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pinchRef.current.pointers.size >= 2) {
        // Capture 2-finger gestures so OrbitControls never runs its dolly handler (crash-prone).
        e.preventDefault();
        e.stopPropagation();
        beginPinchIfReady();
        updatePinch();
      }
    };

    const onPointerUpOrCancel = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      pinchRef.current.pointers.delete(e.pointerId);
      endPinchIfNeeded();
    };

    el.addEventListener('pointerdown', onPointerDown, { capture: true });
    el.addEventListener('pointermove', onPointerMove, { capture: true });
    el.addEventListener('pointerup', onPointerUpOrCancel, { capture: true });
    el.addEventListener('pointercancel', onPointerUpOrCancel, { capture: true });
    el.addEventListener('pointerleave', onPointerUpOrCancel, { capture: true });

    return () => {
      el.removeEventListener('pointerdown', onPointerDown, { capture: true } as any);
      el.removeEventListener('pointermove', onPointerMove, { capture: true } as any);
      el.removeEventListener('pointerup', onPointerUpOrCancel, { capture: true } as any);
      el.removeEventListener('pointercancel', onPointerUpOrCancel, { capture: true } as any);
      el.removeEventListener('pointerleave', onPointerUpOrCancel, { capture: true } as any);
    };
  }, [isTouchLikePointer, disableInteractions]);

  // If interactions are disabled (e.g. bottom-sheet expanded), ensure the canvas won't intercept touches at all.
  useEffect(() => {
    const el = canvasDomRef.current as any;
    if (!el) return;
    try {
      el.style.pointerEvents = disableInteractions ? 'none' : 'auto';
    } catch {
      // ignore
    }
  }, [disableInteractions]);

  // Track mouse position for hover preview
  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  };
  
  // Handle right-click on star
  const handleStarRightClick = (result: QuoteResult, event: any) => {
    // R3F event handling - prevent default context menu
    if (event.nativeEvent) {
      event.nativeEvent.preventDefault();
    }
    // Get client position from the event
    const clientX = event.clientX || (event.nativeEvent && event.nativeEvent.clientX) || 0;
    const clientY = event.clientY || (event.nativeEvent && event.nativeEvent.clientY) || 0;
    
    setContextMenu({
      result,
      position: { x: clientX, y: clientY }
    });
  };

  // Prepare camera intro animation whenever a new set of results arrives.
  // We only signal that an animation should start here; the actual parameters
  // are initialized lazily inside the AnimatedCamera when the camera ref is ready.
  // DISABLED: Camera animation causes visible "frame jump" when results load during warp speed
  useEffect(() => {
    if (!results || results.length === 0) return;
    
    // Don't restart animation if one is already in progress
    if (isAnimatingCamera) {
      return;
    }
    
    cameraAnimationRef.current = null; // force re-init in AnimatedCamera
    setIsAnimatingCamera(true);
    setCameraAnimKey(prev => prev + 1); // Force AnimatedCamera to remount
  }, [results]);

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

  // Cleanup research hover timeout on unmount
  useEffect(() => {
    return () => {
      if (researchHoverTimeoutRef.current) {
        clearTimeout(researchHoverTimeoutRef.current);
      }
      if (saveToastTimeoutRef.current) {
        clearTimeout(saveToastTimeoutRef.current);
      }
    };
  }, []);

  // Helper to show save toast
  const showSaveToast = (type: 'success' | 'error' | 'loading', message: string) => {
    setSaveToast({ show: true, type, message });
    if (saveToastTimeoutRef.current) {
      clearTimeout(saveToastTimeoutRef.current);
    }
    // Only auto-hide success and error toasts, not loading
    if (type !== 'loading') {
      saveToastTimeoutRef.current = setTimeout(() => {
        setSaveToast({ show: false, type: 'success', message: '' });
      }, 3000);
    }
  };

  const showShareToast = (type: 'success' | 'error' | 'loading', message: string) => {
    setShareToast({ show: true, type, message });
    if (shareToastTimeoutRef.current) {
      clearTimeout(shareToastTimeoutRef.current);
    }
    // Only auto-hide success and error toasts, not loading
    if (type !== 'loading') {
      shareToastTimeoutRef.current = setTimeout(() => {
        setShareToast({ show: false, type: 'success', message: '' });
      }, 3000);
    }
  };

  // Handle sharing the research session - opens modal
  const handleShareSession = () => {
    if (isSharing) return;
    if (!researchSessionItems || researchSessionItems.length === 0) {
      showShareToast('error', 'No items to share');
      return;
    }
    setIsShareModalOpen(true);
  };

  // Actually perform the share with optional custom title
  const performShare = async (customTitle?: string) => {
    try {
      setIsSharing(true);
      showShareToast('loading', 'Creating share link...');

      // Build nodes array from research session items with their galaxy coordinates
      const nodes: ShareNode[] = researchSessionItems
        .map(item => {
          // Find the result in the galaxy view to get coordinates and color
          const result = results.find(r => r.shareLink === item.shareLink);
          if (!result || !result.coordinates3d) {
            return null;
          }

          return {
            pineconeId: item.shareLink,
            x: result.coordinates3d.x,
            y: result.coordinates3d.y,
            z: result.coordinates3d.z,
            color: getHierarchyColor(result.hierarchyLevel)
          };
        })
        .filter((node): node is ShareNode => node !== null);

      if (nodes.length === 0) {
        showShareToast('error', 'No valid items to share');
        setIsSharing(false);
        setIsShareModalOpen(false);
        return;
      }

      // Use custom title if provided, otherwise use suggested title from last item
      let title = customTitle;
      if (!title) {
      const lastItem = researchSessionItems[researchSessionItems.length - 1];
        title = lastItem.headline || lastItem.summary || undefined;
      }

      const response = await shareCurrentSession(title, nodes);

      if (response.success && response.data) {
        // Copy share URL to clipboard
        const copied = await copyToClipboard(response.data.shareUrl);
        if (copied) {
          showShareToast('success', 'Link copied to clipboard!');
        } else {
          showShareToast('success', 'Share link created');
        }
      } else {
        showShareToast('error', 'Failed to create share link');
      }
    } catch (error) {
      console.error('Share session error:', error);
      const message = error instanceof Error ? error.message : 'Failed to share session';
      showShareToast('error', message);
    } finally {
      setIsSharing(false);
      setIsShareModalOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black select-none" onMouseMove={handleMouseMove}>
      {/* Warp Speed Loading Overlay - always on top when active */}
      <WarpSpeedLoadingOverlay 
        isLoading={isLoading}
        onDecelerationComplete={onDecelerationComplete}
      />
      
      {/* Left Side Controls - Vertical Stack */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-3">
        {/* Brand Image - Top Left Corner (embed mode) */}
        {/* Mobile: h-8 (~30% smaller), Desktop: h-12 */}
        {brandImage && (
          <div className="pointer-events-none w-fit">
            <img 
              src={brandImage} 
              alt="Brand Logo" 
              className="h-8 sm:h-12 w-auto object-contain rounded-md shadow-xl"
              onError={(e) => {
                // Hide image if it fails to load
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}
        
        {/* Shared Session Title Banner - hidden in compact height mode */}
        {/* Mobile: smaller text and padding, Desktop: larger */}
        {sharedSessionTitle && !isCompactHeight && (
          <div className="pointer-events-none">
            <div className="bg-black/90 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1.5 sm:px-6 sm:py-3 shadow-xl">
              <h2 className="text-white text-sm sm:text-lg font-medium tracking-wide">
                {sharedSessionTitle}
              </h2>
            </div>
          </div>
        )}
        
        {/* Minimap - Hidden in embed mode */}
        {/* {!hideStats && (
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <canvas
              ref={minimapCanvasRef}
              width={105}
              height={105}
              className="block"
            />
          </div>
        )} */}
        
        {/* Camera reset button - hidden in compact height mode */}
        {!isCompactHeight && (
          <button
            onClick={handleResetCamera}
            className="px-2.5 py-2 bg-black/80 backdrop-blur-sm text-white rounded-lg border border-gray-700 hover:bg-black/90 transition-colors text-sm flex items-center gap-1 w-fit"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        )}

        {/* Options Menu */}
        {!hideOptions && (
          <div className="relative w-fit">
            <button
              onClick={() => setShowOptionsMenu((prev) => !prev)}
              className="px-3 py-2 backdrop-blur-sm text-white rounded-lg border border-gray-700 bg-black/80 hover:bg-black/90 transition-colors text-sm flex items-center gap-2"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Options</span>
            </button>

            {showOptionsMenu && (
              <div className="mt-2 w-56 bg-black/95 border border-gray-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                <button
                  onClick={handleToggleAxisLabels}
                  className="w-full px-3 py-2 flex items-center gap-2 text-xs text-gray-200 hover:bg-gray-800/80 transition-colors"
                >
                  <div
                    className={`w-3 h-3 rounded border border-gray-400 flex items-center justify-center ${
                      showAxisLabels ? 'bg-white' : 'bg-transparent'
                    }`}
                  >
                    {showAxisLabels && <Check className="w-2 h-2 text-black" />}
                  </div>
                  <span>Label Axes</span>
                </button>
                <button
                  onClick={() => {
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
                  className="w-full px-3 py-2 flex items-center gap-2 text-xs text-gray-200 hover:bg-gray-800/80 transition-colors"
                >
                  <div
                    className={`w-3 h-3 rounded border border-gray-400 flex items-center justify-center ${
                      autoPlayOnStarClick ? 'bg-white' : 'bg-transparent'
                    }`}
                  >
                    {autoPlayOnStarClick && <Check className="w-2 h-2 text-black" />}
                  </div>
                  <span>Auto‑play on star click</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Hover preview for stars */}
      <HoverPreview 
        result={hoveredResult} 
        position={mousePosition}
      />

      {/* Hover preview for research items (with delay) */}
      {showResearchTooltip && hoveredResearchItem && (
        <HoverPreview 
          result={{
            shareLink: hoveredResearchItem.shareLink,
            quote: hoveredResearchItem.quote,
            summary: hoveredResearchItem.summary,
            headline: hoveredResearchItem.headline,
            episode: hoveredResearchItem.episode,
            creator: hoveredResearchItem.creator,
            episodeImage: hoveredResearchItem.episodeImage,
            date: hoveredResearchItem.date,
            hierarchyLevel: hoveredResearchItem.hierarchyLevel,
            // Add dummy values for required fields
            shareUrl: '',
            audioUrl: '',
            timeContext: { start_time: null, end_time: null },
            similarity: { combined: 0, vector: 0 },
            coordinates3d: { x: 0, y: 0, z: 0 },
          } as QuoteResult}
          position={mousePosition}
        />
      )}

      {/* Stats overlay with Legend and Research Session - Hidden when hideStats is true */}
      {!hideStats && (
      <div
        className={`absolute top-2 right-4 bg-black/80 backdrop-blur-sm text-white rounded-lg border border-gray-700 text-sm z-10 ${
          compactStats ? 'px-2 py-1.5 max-w-[220px]' : 'max-w-[200px] max-h-[calc(100vh-8rem)] flex flex-col'
        }`}
      >
        {compactStats ? (
          <div className="flex items-center gap-2 min-w-0">
            <Search className="w-4 h-4 flex-shrink-0 text-gray-400" />
            <div className="text-xs text-gray-200 truncate min-w-0" title={query || undefined}>
              {(query && query.trim()) ? query : 'Search'}
              <span className="text-gray-500"> • </span>
              <span className="text-gray-200">{results.length}</span>
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 px-3 py-2">
            <div className="flex flex-col gap-3">
              {/* Query Display */}
              {query && (
                <>
                  <div className="flex items-start gap-2 min-w-0 group relative">
                    <Search className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                    <div 
                      className="text-xs text-gray-200 line-clamp-2 break-words overflow-hidden flex-1 cursor-help"
                      title={query}
                    >
                      {query}
                    </div>
                  </div>
                  <div className="border-t border-gray-700" />
                </>
              )}
              
              {/* Stats */}
              <div className="flex flex-col gap-1 text-xs">
                <div>Results: {results.length}</div>
              </div>
              
              {/* Legend */}
              <div className="border-t border-gray-700 pt-2">
                <div className="text-xs text-gray-400 mb-2">Hierarchy Levels</div>
                <div className="flex flex-col gap-1">
                  {Object.entries(HIERARCHY_COLORS)
                    .filter(([level]) => level !== 'ALL_PODS' && level !== 'FEED')
                    .map(([level, color]) => (
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

              {/* Research Session Section */}
              <div className="border-t border-gray-700 pt-2">
                <button
                  onClick={() => setIsResearchCollapsed(!isResearchCollapsed)}
                  className="w-full flex items-center justify-between mb-2 hover:text-gray-300 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" />
                    <span className="text-[0.65rem] font-medium">Research</span>
                    {researchSessionItems.length > 0 && (
                      <span className="text-[0.6rem] text-gray-400">
                        ({researchSessionItems.length}/{MAX_RESEARCH_ITEMS})
                      </span>
                    )}
                  </div>
                  {isResearchCollapsed ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronUp className="w-3 h-3" />
                  )}
                </button>

                {!isResearchCollapsed && (
                  <>
                    {researchSessionItems.length > 0 ? (
                      <div 
                        className="space-y-2 overflow-y-auto"
                        style={{
                          maxHeight: researchSessionItems.length > RESEARCH_SESSION_CONFIG.MAX_VISIBLE_ITEMS 
                            ? `${RESEARCH_SESSION_CONFIG.MAX_VISIBLE_ITEMS * 38}px` // ~38px per item (including gap)
                            : 'none'
                        }}
                      >
                        {researchSessionItems.map((item) => {
                          // Use same logic as HoverPreview for content preview
                          const contentPreview = item.summary || item.quote || 'No preview';
                          const hierarchyColor = getHierarchyColor(item.hierarchyLevel);
                          
                          return (
                            <div
                              key={item.shareLink}
                              className="bg-gray-900/50 rounded p-1.5 hover:bg-gray-900/70 transition-colors group"
                              onMouseEnter={(e) => {
                                // Clear any existing timeout
                                if (researchHoverTimeoutRef.current) {
                                  clearTimeout(researchHoverTimeoutRef.current);
                                }
                                
                                setHoveredResearchItem(item);
                                setMousePosition({ x: e.clientX, y: e.clientY });
                                
                                // Set timeout for 2 seconds before showing tooltip
                                researchHoverTimeoutRef.current = setTimeout(() => {
                                  setShowResearchTooltip(true);
                                }, 1000);
                              }}
                              onMouseMove={(e) => {
                                setMousePosition({ x: e.clientX, y: e.clientY });
                              }}
                              onMouseLeave={() => {
                                // Clear timeout if user moves away before 2 seconds
                                if (researchHoverTimeoutRef.current) {
                                  clearTimeout(researchHoverTimeoutRef.current);
                                }
                                setHoveredResearchItem(null);
                                setShowResearchTooltip(false);
                              }}
                            >
                              <div className="flex gap-1.5 items-start">
                                {/* Hierarchy Dot */}
                                <div
                                  className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
                                  style={{
                                    backgroundColor: hierarchyColor,
                                    boxShadow: `0 0 4px 1px ${hierarchyColor}`,
                                    border: `1px solid ${hierarchyColor}`,
                                  }}
                                />
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-1">
                                    <p className="text-[0.65rem] text-gray-300 line-clamp-1 leading-tight">
                                      {contentPreview}
                                    </p>
                                    <button
                                      onClick={() => onRemoveFromResearch?.(item.shareLink)}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-400 flex-shrink-0"
                                      aria-label="Remove"
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                  <p className="text-[0.6rem] text-gray-500 mt-0.5 leading-tight line-clamp-1">
                                    {item.episode}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-[0.65rem] text-gray-500 text-center py-2">
                        No items yet
                        <div className="text-[0.6rem] text-gray-600 mt-1">
                          Right-click stars to add
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Action buttons - visible even when collapsed */}
                {researchSessionItems.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    <button
                      onClick={onClearResearch}
                      className="flex-1 p-1.5 border border-gray-700 rounded text-gray-400 hover:text-white hover:border-gray-600 transition-colors group relative"
                      title="Clear all items"
                      aria-label="Clear all items"
                    >
                      <X className="w-3.5 h-3.5 mx-auto" />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/95 text-white text-[0.6rem] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        Clear All
                      </span>
                    </button>
                    
                          <button
                            onClick={async () => {
                              if (isSaving) return; // Prevent double-click
                              
                              try {
                                setIsSaving(true);
                                showSaveToast('loading', 'Saving...');
                                
                                const result = await saveResearchSession((researchSessionItems || []) as ResearchSessionItem[]);
                                
                                setIsSaving(false);
                                if (result.success) {
                                  console.log('Research session saved:', result.data);
                                  showSaveToast('success', 'Session saved');
                                }
                              } catch (error) {
                                setIsSaving(false);
                                console.error('Failed to save research session:', error);
                                showSaveToast('error', 'Save failed');
                              }
                            }}
                            disabled={isSaving}
                            className="flex-1 p-1.5 border border-gray-700 rounded text-gray-400 hover:text-white hover:border-gray-600 transition-colors group relative disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Save session"
                            aria-label="Save session"
                          >
                            <Save className="w-3.5 h-3.5 mx-auto" />
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/95 text-white text-[0.6rem] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              Save
                            </span>
                          </button>
                    
                    <button
                      onClick={() => {
                        // Open analysis panel first, then close context
                        if (onOpenAnalysisPanel) {
                          printLog(`[AI Analysis] Galaxy submenu: user clicked Analyze button (items=${researchSessionItems.length})`);
                          onOpenAnalysisPanel();
                        }
                        // Small delay to ensure analysis opens before context closes
                        setTimeout(() => {
                          if (onCloseContextPanel) {
                            onCloseContextPanel();
                          }
                        }, 0);
                      }}
                      className="flex-1 p-1.5 border border-gray-700 rounded text-gray-400 hover:text-white hover:border-gray-600 transition-colors group relative"
                      title="AI Analysis (Beta)"
                      aria-label="AI Analysis (Beta)"
                    >
                      <BrainCircuit className="w-3.5 h-3.5 mx-auto" />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/95 text-white text-[0.6rem] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        AI Analysis (Beta)
                      </span>
                    </button>
                    
                    <button
                      onClick={handleShareSession}
                      disabled={isSharing || !researchSessionItems || researchSessionItems.length === 0}
                      className="flex-1 p-1.5 border border-gray-700 rounded text-gray-400 hover:text-white hover:border-gray-600 transition-colors group relative disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Share session"
                      aria-label="Share session"
                    >
                      <Share2 className="w-3.5 h-3.5 mx-auto" />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/95 text-white text-[0.6rem] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        Share
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* 3D Canvas */}
      <Canvas
        // Prevent the browser from hijacking touch gestures (scroll/pinch-zoom) which can
        // cause OrbitControls to receive inconsistent touch state and crash on mobile.
        style={{ width: '100%', height: '100%', touchAction: 'none' }}
        resize={{ scroll: false, debounce: 0 }}
        onCreated={({ gl }) => {
          // Belt + suspenders: ensure the actual canvas element disables default touch actions.
          try {
            (gl.domElement as any).style.touchAction = 'none';
            canvasDomRef.current = gl.domElement as any;
          } catch {
            // ignore
          }
        }}
      >
        <PerspectiveCamera
          ref={cameraRef}
          makeDefault
          position={[0, 5, 15]}
          fov={75}
        />
        
        {/* IMPORTANT: When interactions are disabled (mobile bottom-sheet expanded),
            fully unmount OrbitControls so it removes its document-level listeners.
            Merely setting enabled={false} can still leave touch handlers attached that
            interfere with scrolling. */}
        {!disableInteractions && (
          <OrbitControls
            ref={controlsRef}
            enabled={!isAnimatingCamera}
            enableRotate={true}
            enablePan={!isTouchLikePointer}
            enableZoom={!isTouchLikePointer}
            panSpeed={1}
            zoomSpeed={1}
            minDistance={5}
            maxDistance={50}
          />
        )}

        <AnimatedCamera
          key={cameraAnimKey}
          cameraRef={cameraRef}
          controlsRef={controlsRef}
          animationRef={cameraAnimationRef}
          isAnimating={isAnimatingCamera}
          setIsAnimating={setIsAnimatingCamera}
        />

        <GalaxyScene
          results={results}
          selectedStarId={selectedStarId}
          onStarClick={onStarClick}
          onStarRightClick={handleStarRightClick}
          onHover={setHoveredResult}
          axisLabels={axisLabels || null}
          showAxisLabels={showAxisLabels}
          isAnimatingCamera={isAnimatingCamera}
          nebulaDimOpacity={nebulaDimOpacity}
          brandColors={brandColors}
        />
      </Canvas>
      
      {/* Context Menu */}
      {contextMenu && onAddToResearch && (
        <ContextMenu
          options={[
            {
              label: researchSessionShareLinks.includes(contextMenu.result.shareLink)
                ? 'Already in Research'
                : 'Add to Research',
              icon: <Layers className="w-4 h-4" />,
              onClick: () => onAddToResearch(contextMenu.result),
              disabled: researchSessionShareLinks.includes(contextMenu.result.shareLink),
            },
          ]}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Research Session Toast - "Added to Research" */}
      {showResearchToast && (
        <div className="absolute top-2 right-4 z-[60] pointer-events-none animate-slide-in-right" style={{ marginTop: 'calc(var(--stats-panel-height, 300px) + 0.5rem)' }}>
          <div className="bg-black/95 backdrop-blur-sm border border-gray-700 text-white rounded-lg px-3 py-2 shadow-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Added to Research</span>
          </div>
        </div>
      )}

      {/* Save Session Toast - Loading/Success/Error */}
      {saveToast.show && (
        <div className="absolute top-2 right-4 z-[60] pointer-events-none animate-slide-in-right" style={{ marginTop: 'calc(var(--stats-panel-height, 300px) + 0.5rem)' }}>
          <div className={`backdrop-blur-sm border rounded-lg px-3 py-2 shadow-lg flex items-center gap-2 ${
            saveToast.type === 'success'
              ? 'bg-black/95 border-gray-700 text-white'
              : saveToast.type === 'error'
              ? 'bg-red-900/95 border-red-700 text-white'
              : 'bg-blue-900/95 border-blue-700 text-white'
          }`}>
            {saveToast.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : saveToast.type === 'error' ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <Loader className="w-4 h-4 animate-spin" />
            )}
            <span className="text-xs font-medium">{saveToast.message}</span>
          </div>
        </div>
      )}

      {/* Share Session Toast - Loading/Success/Error */}
      {shareToast.show && (
        <div className="absolute top-2 right-4 z-[60] pointer-events-none animate-slide-in-right" style={{ marginTop: 'calc(var(--stats-panel-height, 300px) + 3.5rem)' }}>
          <div className={`backdrop-blur-sm border rounded-lg px-3 py-2 shadow-lg flex items-center gap-2 ${
            shareToast.type === 'success'
              ? 'bg-black/95 border-gray-700 text-white'
              : shareToast.type === 'error'
              ? 'bg-red-900/95 border-red-700 text-white'
              : 'bg-blue-900/95 border-blue-700 text-white'
          }`}>
            {shareToast.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : shareToast.type === 'error' ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <Loader className="w-4 h-4 animate-spin" />
            )}
            <span className="text-xs font-medium">{shareToast.message}</span>
          </div>
        </div>
      )}

      {/* Share Session Modal */}
      <ShareSessionModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onConfirm={performShare}
        suggestedTitle={
          researchSessionItems.length > 0
            ? researchSessionItems[researchSessionItems.length - 1].headline ||
              researchSessionItems[researchSessionItems.length - 1].summary ||
              ''
            : ''
        }
        isSharing={isSharing}
      />
    </div>
  );
};

export default SemanticGalaxyView;

