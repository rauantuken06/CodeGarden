import { test, expect } from '@playwright/test';
import { DEMO_GARDEN } from '../src/data/demo';

const response = {
  repository: {
    owner: 'test', name: 'garden', full_name: 'test/garden',
    description: 'Browser test fixture', stars: 42,
    html_url: 'https://github.com/test/garden', default_branch: 'main',
  },
  garden: {
    ...DEMO_GARDEN, repository: 'test/garden', total_analyzed_commits: 23,
    active_months: 2, bug_fix_count: 0, truncated: true,
    plants: [
      { month: '2026-01', commit_count: 3, stage: 'seedling', x: 56, y: 64 },
      { month: '2026-02', commit_count: 20, stage: 'young_tree', x: 144, y: 64 },
    ], flowers: [],
  },
};

test('real-result UI, plant tooltip, PNG export, errors and reset', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/garden/test/garden', async route => {
    await new Promise(resolve => setTimeout(resolve, 150));
    await route.fulfill({ json: response });
  });
  await page.goto('/');
  await expect(page.locator('.demo-label')).toHaveText('Demo Garden');
  await expect(page.locator('.garden-notes')).toContainText('Local example data');
  await page.getByLabel('GitHub repository URL').fill('https://github.com/test/garden');
  await page.getByRole('button', { name: 'Grow My Garden' }).click();
  await expect(page.getByRole('button', { name: 'Growing' })).toBeDisabled();
  await expect(page.locator('.demo-label')).toHaveText('test/garden Garden');
  await expect(page.locator('.stats')).toContainText('23');
  await expect(page.locator('.history-notice')).toContainText('Partial history');
  await expect(page.locator('canvas')).toHaveAccessibleName(/2 monthly plants and 0 bug-fix flowers/);
  await expect(page.locator('.repository-details')).toContainText('42 stars');

  // Match the first backend plant's position in the Figma clearing.
  const canvas = page.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas is missing');
  await page.mouse.move(box.x + box.width * 276 / 960, box.y + box.height * 273 / 560);
  await expect(page.getByRole('tooltip')).toContainText('2026-01');
  await expect(page.getByRole('tooltip')).toContainText('3 commits');

  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download as PNG' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('test-garden-garden.png');
  const stream = await download.createReadStream();
  if (!stream) throw new Error('No PNG bytes');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const png = Buffer.concat(chunks);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.readUInt32BE(16)).toBe(960);
  expect(png.readUInt32BE(20)).toBe(560);

  await page.route('**/api/garden/test/garden', route => route.fulfill({ status: 429, json: { detail: 'limited' } }));
  await page.getByRole('button', { name: 'Refresh garden' }).click();
  await expect(page.getByRole('alert')).toContainText('request limit');
  await expect(page.locator('.demo-label')).toHaveText('test/garden Garden');
  await page.getByRole('button', { name: 'Analyze another repository' }).click();
  await expect(page.locator('.demo-label')).toHaveText('Demo Garden');
  await expect(page.getByLabel('GitHub repository URL')).toBeFocused();
  expect(errors).toEqual([]);
});

test('mobile empty history and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/garden/test/garden', route => route.fulfill({ json: {
    ...response, garden: { ...response.garden, total_analyzed_commits: 0, active_months: 0, truncated: false, plants: [], flowers: [] },
  } }));
  await page.goto('/');
  await expect(page.locator('.explore-hint')).toContainText('Still garden');
  const before = await page.locator('canvas').evaluate(canvas => canvas.toDataURL());
  await page.waitForTimeout(120);
  expect(await page.locator('canvas').evaluate(canvas => canvas.toDataURL())).toBe(before);
  await page.getByLabel('GitHub repository URL').fill('https://github.com/test/garden');
  await page.getByRole('button', { name: 'Grow My Garden' }).click();
  await expect(page.locator('.garden-notes')).toContainText('No commits yet');
  await expect(page.locator('canvas')).toHaveAccessibleName(/0 monthly plants and 0 bug-fix flowers/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile-empty.png', fullPage: true });
});

test('invalid repository and upstream failure never become a successful garden', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/garden/**', route => {
    requests++;
    return route.fulfill({ status: 503, json: { detail: 'unavailable' } });
  });
  await page.goto('/');
  await page.getByLabel('GitHub repository URL').fill('https://gitlab.com/test/garden');
  await page.getByRole('button', { name: 'Grow My Garden' }).click();
  await expect(page.getByRole('alert')).toContainText('Enter a GitHub URL');
  expect(requests).toBe(0);
  await page.getByLabel('GitHub repository URL').fill('https://github.com/test/garden');
  await page.getByRole('button', { name: 'Grow My Garden' }).click();
  await expect(page.getByRole('alert')).toContainText('temporarily unreachable');
  await expect(page.locator('.demo-label')).toHaveText('Demo Garden');
  await expect(page.locator('.garden-notes')).toContainText('Local example data');
  expect(requests).toBe(1);
});
