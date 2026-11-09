import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGarden, parseRepositoryURL } from './api';
import { DEMO_GARDEN } from './data/demo';

afterEach(() => vi.unstubAllGlobals());

describe('repository URL validation', () => {
  it.each([
    'https://github.com/psf/requests',
    'https://github.com/psf/requests/',
    ' https://github.com/psf/requests.git ',
  ])('extracts the repository from %s', value => {
    expect(parseRepositoryURL(value)).toEqual({ owner: 'psf', repo: 'requests' });
  });
  it.each([
    'https://github.com.evil.example/psf/requests',
    'https://github.com@evil.example/psf/requests',
    'http://github.com/psf/requests',
    'https://github.com:443/psf/requests',
    'https://github.com/psf/requests/tree/main',
    'https://github.com/psf/requests?tab=readme',
    'https://github.com/psf/requests#readme',
    'https://github.com/bad_owner/requests',
    'https://github.com/psf/my%20repo',
    '',
  ])('rejects %s', value => expect(() => parseRepositoryURL(value)).toThrow());
});

it('calls the Python endpoint and returns its data unchanged', async () => {
  const payload = { repository: { full_name: 'psf/requests' }, garden: DEMO_GARDEN };
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload)));
  vi.stubGlobal('fetch', fetchMock);
  const controller = new AbortController();
  expect(await fetchGarden('https://github.com/psf/requests', controller.signal)).toEqual(payload);
  expect(fetchMock).toHaveBeenCalledWith('/api/garden/psf/requests', { signal: controller.signal });
});

it.each([404, 422, 429, 500, 502, 503])('rejects HTTP %s without demo fallback', async status => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('upstream failure', { status })));
  await expect(fetchGarden('https://github.com/psf/requests')).rejects.toMatchObject({ status });
});

it('reports an unavailable Python server', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network failure')));
  await expect(fetchGarden('https://github.com/psf/requests')).rejects.toThrow('Cannot reach CodeGarden');
});

it('rejects invalid JSON', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not JSON')));
  await expect(fetchGarden('https://github.com/psf/requests')).rejects.toThrow('unreadable');
});
