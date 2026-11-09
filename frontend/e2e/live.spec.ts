import { test, expect } from '@playwright/test';
import type { GardenResponse } from '../src/types';

test('public GitHub repository through Vite proxy and real FastAPI', async ({ page }) => {
  test.skip(process.env.CODEGARDEN_LIVE !== '1', 'Opt in with CODEGARDEN_LIVE=1 and start FastAPI on port 8000.');
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('GitHub repository URL').fill('https://github.com/psf/requests');
  const request = page.waitForResponse(response => response.url().endsWith('/api/garden/psf/requests'));
  await page.getByRole('button', { name: 'Grow My Garden' }).click();
  const response = await request;
  const data = await response.json() as GardenResponse;
  expect(response.status(), JSON.stringify(data)).toBe(200);
  expect(data.repository.full_name).toBe('psf/requests');
  expect(data.garden.total_analyzed_commits).toBeGreaterThan(0);
  await expect(page.locator('.demo-label')).toHaveText('psf/requests Garden');
  await expect(page.locator('.stats .stat').first()).toContainText(String(data.garden.total_analyzed_commits));
  await expect(page.locator('canvas')).toHaveAccessibleName(new RegExp(`${data.garden.plants.length} monthly plants and ${data.garden.flowers.length} bug-fix flowers`));
  await expect(page.locator('.garden-notes')).not.toContainText('Local example data');
  if (data.garden.truncated) await expect(page.locator('.history-notice')).toBeVisible();
  await page.waitForTimeout(1800);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: 'test-results/live-desktop.png', fullPage: true });
  await page.locator('canvas').screenshot({ path: 'test-results/live-island.png' });
  console.log(JSON.stringify({ repository: data.repository.full_name, commits: data.garden.total_analyzed_commits, plants: data.garden.plants.length, flowers: data.garden.flowers.length, truncated: data.garden.truncated }));
  expect(errors).toEqual([]);
});
