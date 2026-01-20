import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

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
      accum += w * exp(-9.025 * pow(max(abs(mag - prev), 0.0), 2.2));
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
    vec4 col = vec4(pow(max(rnd.y, 0.0), 17.0));
    float mul = 10.0 * rnd.x;
    col.xyz *= sin(time * mul + mul) * 0.25 + 1.0;
    return col;
  }

  void mainImage( out vec4 fragColor, in vec2 fragCoord )
  {
    // FAST TIME - use iTime directly without resolution division
    float time = iTime;
    
    // first layer of the kaliset fractal
    vec2 uv = 2.0 * fragCoord / iResolution.xy - 1.0;
    vec2 uvs = uv * iResolution.xy / max(iResolution.x, iResolution.y);
    vec3 p = vec3(uvs / 2.5, 0.0) + vec3(0.8, -1.3, 0.0);
    
    // FASTER movement - reduced divisors from 32/24/64 to 4/3/8
    p += 0.45 * vec3(sin(time / 4.0), sin(time / 3.0), sin(time / 8.0));
    
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
    
    // second layer of the kaliset fractal - FASTER oscillation
    vec3 p2 = vec3(uvs / (4.0 + sin(time * 0.5) * 0.2 + 0.2 + sin(time * 0.7) * 0.3 + 0.4), 4.0) + vec3(2.0, -1.3, -1.0);
    p2 += 0.16 * vec3(sin(time / 4.0), sin(time / 3.0), sin(time / 8.0));
    
    // adjust second layer position based on mouse movement
    p2.x += mix(-0.01, 0.01, (iMouse.x / iResolution.x));
    p2.y += mix(-0.01, 0.01, (iMouse.y / iResolution.y));
    float t2 = field(p2, freqs[3], 18);
    vec4 c2 = mix(0.5, 0.2, v) * vec4(5.5 * t2 * t2 * t2, 2.1 * t2 * t2, 2.2 * t2 * freqs[0], t2);
    
    // add stars with faster twinkle
    vec4 starColour = vec4(0.0);
    starColour += starLayer(p.xy, time * 2.0);
    starColour += starLayer(p2.xy, time * 2.0);

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

// Animation speed multiplier - shader now uses time directly, so 1.0 = normal speed
const NEBULA_TIME_MULTIPLIER = 1.0;

// Camera drift configuration for the "alive" feeling
const CAMERA_DRIFT_CONFIG = {
  AMPLITUDE: 0.8,      // How far the camera drifts
  SPEED_X: 0.5,        // Speed of horizontal drift
  SPEED_Y: 0.35,       // Speed of vertical drift  
  SPEED_Z: 0.25,       // Speed of depth drift
};

interface NebulaSceneProps {
  dimOpacity: number;
  manualTime: number;
}

// The nebula scene that fills the viewport - same approach as SemanticGalaxyView
const NebulaScene: React.FC<NebulaSceneProps> = ({ dimOpacity, manualTime }) => {
  const groupRef = useRef<THREE.Group | null>(null);
  const { camera, size, pointer } = useThree();
  
  // Memoize uniforms to ensure they persist and don't get recreated
  const uniforms = useMemo(() => ({
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector3(1, 1, 1.0) },
    iMouse: { value: new THREE.Vector4(0, 0, 0, 0) },
  }), []);

  useFrame(() => {
    if (!groupRef.current) {
      console.log('[Nebula useFrame] groupRef not ready');
      return;
    }

    // Use manually tracked time to ensure continuous animation even when R3F clock pauses
    const time = manualTime;

    // Update shader uniforms directly on the memoized object (this is the key!)
    const newTime = time * NEBULA_TIME_MULTIPLIER;
    uniforms.iTime.value = newTime;
    uniforms.iResolution.value.set(size.width, size.height, 1.0);
    
    // Log every second to verify uniform is updating
    if (Math.floor(time) !== Math.floor(time - 0.017)) {
      console.log('[Nebula] iTime =', newTime.toFixed(2));
    }

    // Subtle camera drift animation - makes the background feel alive
    const driftX = Math.sin(time * CAMERA_DRIFT_CONFIG.SPEED_X) * CAMERA_DRIFT_CONFIG.AMPLITUDE;
    const driftY = Math.cos(time * CAMERA_DRIFT_CONFIG.SPEED_Y) * CAMERA_DRIFT_CONFIG.AMPLITUDE * 0.7;
    const driftZ = Math.sin(time * CAMERA_DRIFT_CONFIG.SPEED_Z + 1.5) * CAMERA_DRIFT_CONFIG.AMPLITUDE * 0.5;

    // Apply drift to camera position
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    perspectiveCamera.position.x = driftX;
    perspectiveCamera.position.y = driftY;
    perspectiveCamera.position.z = 15 + driftZ;

    // Map normalized pointer (-1..1) to pixel coordinates for iMouse
    const mouseX = (pointer.x * 0.5 + 0.5) * size.width;
    const mouseY = (pointer.y * -0.5 + 0.5) * size.height;
    uniforms.iMouse.value.set(mouseX, mouseY, 0.0, 0.0);

    // Position the quad in front of the camera and match its orientation
    const distance = 10;

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
          vertexShader={NEBULA_VERTEX_SHADER}
          fragmentShader={NEBULA_FRAGMENT_SHADER}
          uniforms={uniforms}
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

export interface NebulaBackgroundProps {
  /** How much to dim the nebula (0 = full color, 1 = black). Default: 0.5 */
  dimOpacity?: number;
  /** Additional CSS class names */
  className?: string;
}

// Inner component that tracks time and forces continuous animation
const NebulaCanvasContent: React.FC<{ dimOpacity: number }> = ({ dimOpacity }) => {
  const [time, setTime] = useState(0);
  const startTimeRef = useRef(Date.now());
  const lastLogTimeRef = useRef(0);
  const { invalidate, camera } = useThree();
  
  useEffect(() => {
    let animationId: number;
    
    const animate = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setTime(elapsed);
      invalidate(); // Force R3F to re-render
      
      // Log position hash every 2 seconds
      if (elapsed - lastLogTimeRef.current >= 2) {
        lastLogTimeRef.current = elapsed;
        const shaderTime = elapsed * NEBULA_TIME_MULTIPLIER;
        console.log(`[Nebula] t=${elapsed.toFixed(1)}s shaderT=${shaderTime.toFixed(1)}`);
      }
      
      animationId = requestAnimationFrame(animate);
    };
    
    animationId = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [invalidate, camera]);
  
  return <NebulaScene dimOpacity={dimOpacity} manualTime={time} />;
};

/**
 * Standalone animated nebula background using WebGL shaders.
 * This is the same nebula effect used in SemanticGalaxyView.
 */
export const NebulaBackground: React.FC<NebulaBackgroundProps> = ({
  dimOpacity = 0.5,
  className = '',
}) => {
  return (
    <div 
      className={className}
      style={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <Canvas
        style={{ 
          display: 'block',
          width: '100%', 
          height: '100%',
        }}
        camera={{ position: [0, 0, 15], fov: 75 }}
        gl={{ antialias: false, alpha: false }}
        frameloop="demand"
      >
        <NebulaCanvasContent dimOpacity={dimOpacity} />
      </Canvas>
    </div>
  );
};

export default NebulaBackground;
