import React, { useState, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { HIERARCHY_COLORS } from '../constants/constants.ts';
import { Calendar } from 'lucide-react';
import { formatShortDate } from '../utils/time.ts';

interface QuoteResult {
  shareLink: string;
  shareUrl: string;
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

const Star: React.FC<StarProps> = ({ result, isSelected, isNearSelected, onClick, onHover }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Pulsing animation for selected star
  useFrame((state) => {
    if (meshRef.current && isSelected) {
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.1 + 1;
      meshRef.current.scale.set(pulse, pulse, pulse);
    } else if (meshRef.current) {
      meshRef.current.scale.set(1, 1, 1);
    }
  });

  const color = getHierarchyColor(result.hierarchyLevel);
  const opacity = isSelected ? 1 : isNearSelected ? 0.6 : 1;
  const scale = isSelected ? 1.5 : hovered ? 1.3 : 1;

  return (
    <mesh
      ref={meshRef}
      position={[result.coordinates3d.x * 10, result.coordinates3d.y * 10, result.coordinates3d.z * 10]}
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
      scale={scale}
    >
      <sphereGeometry args={[0.15, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={isSelected ? 0.8 : hovered ? 0.6 : 0.3}
        opacity={opacity}
        transparent
      />
    </mesh>
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
}> = ({ results, selectedStarId, onStarClick, onHover }) => {
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

  return (
    <>
      {/* Ambient light */}
      <ambientLight intensity={0.3} />
      
      {/* Point light at origin */}
      <pointLight position={[0, 0, 0]} intensity={0.5} />

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

      {/* Grid helper */}
      <gridHelper args={[20, 20, '#333333', '#1a1a1a']} position={[0, -10, 0]} />
    </>
  );
};

// Main component
export const SemanticGalaxyView: React.FC<SemanticGalaxyViewProps> = ({
  results,
  onStarClick,
  selectedStarId,
}) => {
  const [hoveredResult, setHoveredResult] = useState<QuoteResult | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
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

  return (
    <div className="relative w-full h-screen bg-black" onMouseMove={handleMouseMove}>
      {/* Camera reset button */}
      <CameraResetButton onReset={handleResetCamera} />

      {/* Minimap */}
      <Minimap results={results} selectedStarId={selectedStarId} />

      {/* Hover preview */}
      <HoverPreview result={hoveredResult} position={mousePosition} />

      {/* Stats overlay */}
      <div className="absolute top-4 right-4 px-3 py-2 bg-black/80 backdrop-blur-sm text-white rounded-lg border border-gray-700 text-sm z-10">
        <div className="flex flex-col gap-1">
          <div>Results: {results.length}</div>
          {selectedStarId && <div className="text-gray-400">Star selected</div>}
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 px-3 py-2 bg-black/80 backdrop-blur-sm rounded-lg border border-gray-700 z-10">
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
        />
      </Canvas>
    </div>
  );
};

export default SemanticGalaxyView;

