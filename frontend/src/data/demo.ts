import type { GardenData, PlantStage } from '../types';

// Hand-authored illustration. These are example counts, never GitHub results.
const counts = [4, 8, 18, 36, 9, 3, 22, 35, 6, 16, 32, 12];
const stage = (n: number): PlantStage => n < 5 ? 'seedling' : n < 15 ? 'small_plant' : n < 30 ? 'young_tree' : 'mature_tree';
export const DEMO_GARDEN: GardenData = {
  repository: 'demo/example',
  total_analyzed_commits: counts.reduce((sum, count) => sum + count, 0),
  active_months: 12, bug_fix_count: 12, truncated: false,
  width: 384, height: 256,
  plant_display_limit: 12, flower_display_limit: 12,
  hidden_plants: 0, hidden_flowers: 0,
  plants: counts.map((count, index) => ({
    month: `2025-${String(index + 1).padStart(2, '0')}`,
    commit_count: count, stage: stage(count),
    x: 56 + index % 4 * 88, y: 64 + Math.floor(index / 4) * 68,
  })),
  flowers: Array.from({ length: 12 }, (_, index) => ({ x: 20 + index * 30, y: 240 })),
};
