import { useEffect, useRef, useState } from 'react';
import type { GardenData } from '../types';
import { H, W, STAGE_NAMES, type HoveredPlant } from '../garden/layout';
import { startGardenRenderer } from '../garden/renderer';

interface Props {
  garden: GardenData;
  label: string;
  demo: boolean;
  onCanvas: (canvas: HTMLCanvasElement | null) => void;
  onSnapshot: (snapshot: (() => void) | null) => void;
}

export function GardenCanvas({ garden, label, demo, onCanvas, onSnapshot }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<HoveredPlant | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReducedMotion(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setHovered(null);
    const renderer = startGardenRenderer(canvas, garden, setHovered, reducedMotion);
    onCanvas(canvas);
    onSnapshot(renderer.snapshot);
    return () => { renderer.dispose(); onCanvas(null); onSnapshot(null); };
  }, [garden, reducedMotion, onCanvas, onSnapshot]);

  return (
    <div className="garden-frame">
      <div className="garden-topbar">
        <span className="demo-label"><span />{label}</span>
        <span className="garden-weather">{demo ? 'EXAMPLE DATA' : 'GITHUB · DEFAULT BRANCH'}</span>
      </div>
      <div className="canvas-wrap">
        <canvas ref={canvasRef} width={W} height={H}
          aria-label={`${label}: ${garden.plants.length} monthly plants and ${garden.flowers.length} bug-fix flowers on an isometric island`}>
          {garden.plants.map(plant => `${plant.month}: ${plant.commit_count} commits, ${plant.stage}`).join('; ')}
        </canvas>
        {hovered && <div role="tooltip" className="plant-tooltip" style={{
          left: `${Math.min(88, Math.max(12, hovered.x / W * 100))}%`,
          top: `${Math.max(4, hovered.y / H * 100)}%`,
        }}>
          <span>{STAGE_NAMES[hovered.stage]}</span>
          <strong>{hovered.month}</strong>
          <small>{hovered.commits} commits</small>
        </div>}
        <span className="explore-hint">{reducedMotion ? 'Still garden · Hover a plant' : 'Move to explore · Hover a plant'}</span>
      </div>
      <div className="garden-key" aria-hidden="true">
        <span><i className="key-seed" /> Seedling</span>
        <span><i className="key-plant" /> Small plant</span>
        <span><i className="key-tree" /> Young tree</span>
        <span><i className="key-mature" /> Mature tree</span>
      </div>
    </div>
  );
}
