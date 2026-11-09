/** Mirrors backend/app/schemas.py. Counts describe analyzed history only. */
export type PlantStage = 'seedling' | 'small_plant' | 'young_tree' | 'mature_tree';
export interface Plant {
  month: string;
  commit_count: number;
  stage: PlantStage;
  x: number;
  y: number;
}
export interface Flower { x: number; y: number }
export interface GardenData {
  repository: string;
  total_analyzed_commits: number;
  active_months: number;
  bug_fix_count: number;
  truncated: boolean;
  width: number;
  height: number;
  plant_display_limit: number;
  flower_display_limit: number;
  hidden_plants: number;
  hidden_flowers: number;
  plants: Plant[];
  flowers: Flower[];
}
export interface RepositoryMetadata {
  owner: string;
  name: string;
  full_name: string;
  description: string | null;
  stars: number;
  html_url: string;
  default_branch: string;
}
export interface GardenResponse {
  repository: RepositoryMetadata;
  garden: GardenData;
}
