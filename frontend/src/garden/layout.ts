import type { GardenData, Plant, PlantStage } from '../types';

export const W = 960;
export const H = 560;
export const STAGES: Record<PlantStage, number> = {
  seedling: 0, small_plant: 1, young_tree: 2, mature_tree: 3,
};
export const STAGE_NAMES = ['Seedling', 'Small plant', 'Young tree', 'Mature tree'];
export interface VisualPlant {
  x: number; y: number; stage: number; variant: number; month: string; commits: number;
}
export interface HoveredPlant extends Omit<VisualPlant, 'variant'> {}

// Retain the original Figma clearings around the trail and pond. The backend's
// 4-by-3 grid selects a clearing; its SHA-256 offsets are preserved within it.
const clearings = [
  [276, 286], [337, 253], [407, 236], [594, 238],
  [668, 266], [714, 312], [651, 345], [610, 408],
  [408, 414], [350, 400], [260, 349], [419, 319],
];
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

export function hashText(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mapPlant(plant: Plant, garden: GardenData): VisualPlant {
  const bx = plant.x / garden.width * 384;
  const by = plant.y / garden.height * 256;
  const column = clamp(Math.round((bx - 56) / 88), 0, 3);
  const row = clamp(Math.round((by - 64) / 68), 0, 2);
  const [x, y] = clearings[row * 4 + column];
  return {
    x: x + clamp(bx - (56 + column * 88), -12, 12) * 1.3,
    y: y + clamp(by - (64 + row * 68), -8, 8),
    stage: STAGES[plant.stage],
    variant: hashText(`${garden.repository}:${plant.month}`) % 3,
    month: plant.month,
    commits: plant.commit_count,
  };
}

export function mapFlowers(garden: GardenData) {
  return garden.flowers.map(flower => {
    const bx = flower.x / garden.width * 384;
    const by = flower.y / garden.height * 256;
    const slot = clamp(Math.round((bx - 20) / 30), 0, 11);
    return {
      x: 298 + (slot % 4) * 31 + clamp(bx - (20 + slot * 30), -8, 8),
      y: 281 + Math.floor(slot / 4) * 36 + clamp(by - 240, -8, 8),
      variant: slot % 4,
    };
  });
}

export function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
