import { describe, expect, it } from 'vitest';
import { DEMO_GARDEN } from '../data/demo';
import { hashText, mapFlowers, mapPlant, STAGES } from './layout';

describe('backend to island mapping', () => {
  it('preserves every backend month, count and stage', () => {
    const before = structuredClone(DEMO_GARDEN);
    const plants = DEMO_GARDEN.plants.map(plant => mapPlant(plant, DEMO_GARDEN));
    expect(plants).toHaveLength(DEMO_GARDEN.plants.length);
    plants.forEach((plant, index) => {
      expect(plant.month).toBe(DEMO_GARDEN.plants[index].month);
      expect(plant.commits).toBe(DEMO_GARDEN.plants[index].commit_count);
      expect(plant.stage).toBe(STAGES[DEMO_GARDEN.plants[index].stage]);
      expect(plant.x).toBeGreaterThan(200);
      expect(plant.x).toBeLessThan(760);
      expect(plant.y).toBeGreaterThan(200);
      expect(plant.y).toBeLessThan(450);
    });
    expect(DEMO_GARDEN).toEqual(before);
    expect(new Set(plants.map(plant => `${plant.x}:${plant.y}`)).size).toBe(plants.length);
  });

  it('uses actual backend offsets within the original clearings', () => {
    const plant = DEMO_GARDEN.plants[0];
    const first = mapPlant(plant, DEMO_GARDEN);
    const moved = mapPlant({ ...plant, x: plant.x + 4, y: plant.y - 3 }, DEMO_GARDEN);
    expect(moved.x - first.x).toBeCloseTo(5.2);
    expect(moved.y - first.y).toBe(-3);
    expect(first).toEqual(mapPlant(plant, DEMO_GARDEN));
    expect(hashText('demo/example')).toBe(hashText('demo/example'));
  });

  it('does not fabricate plants or flowers for an empty repository', () => {
    const garden = { ...DEMO_GARDEN, plants: [], flowers: [] };
    expect(garden.plants.map(plant => mapPlant(plant, garden))).toEqual([]);
    expect(mapFlowers(garden)).toEqual([]);
  });

  it('uses flower count and coordinates supplied by the backend', () => {
    const garden = { ...DEMO_GARDEN, flowers: [{ x: 24, y: 238 }] };
    expect(mapFlowers(garden)).toEqual([{ x: 302, y: 279, variant: 0 }]);
  });
});
