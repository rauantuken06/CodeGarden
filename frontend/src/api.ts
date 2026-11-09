import type { GardenResponse } from './types';

export class GardenAPIError extends Error {
  constructor(message: string, public readonly status = 0) { super(message); }
}

export function parseRepositoryURL(value: string): { owner: string; repo: string } {
  const invalid = () => new GardenAPIError('Enter a GitHub URL such as https://github.com/psf/requests.');
  let url: URL;
  const input = value.trim();
  try { url = new URL(input); } catch { throw invalid(); }
  // Inspect the original authority too: URL normalizes explicit :443 ports.
  const authority = /^https:\/\/([^/]+)/i.exec(input)?.[1];
  if (authority?.toLowerCase() !== 'github.com' || url.protocol !== 'https:' ||
      url.username || url.password || url.search || url.hash) throw invalid();
  const parts = url.pathname.replace(/\/$/, '').split('/');
  if (parts.length !== 3 || parts[0] !== '') throw invalid();
  const owner = parts[1];
  const repo = parts[2].replace(/\.git$/, '');
  if (!/^[a-z\d]+(?:-[a-z\d]+)*$/i.test(owner) || owner.length > 39 ||
      !/^[a-z\d._-]+$/i.test(repo) || repo.length > 100 || repo === '.' || repo === '..') throw invalid();
  return { owner, repo };
}

const messages: Record<number, string> = {
  404: 'Repository not found or not publicly accessible.',
  422: 'The repository owner or name is invalid.',
  429: 'GitHub’s request limit has been reached. Please try again later.',
  502: 'GitHub could not provide valid repository data. Please retry.',
  503: 'GitHub is temporarily unreachable. Please retry.',
};

export async function fetchGarden(value: string, signal?: AbortSignal): Promise<GardenResponse> {
  const { owner, repo } = parseRepositoryURL(value);
  let response: Response;
  try {
    response = await fetch(`/api/garden/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new GardenAPIError('Cannot reach CodeGarden. Check your connection and that the Python server is running.');
  }
  if (!response.ok) throw new GardenAPIError(messages[response.status] ?? 'The server could not grow this garden. Please retry.', response.status);
  // Never convert an upstream error into demo data or a successful empty garden.
  try { return await response.json() as GardenResponse; }
  catch { throw new GardenAPIError('The server returned an unreadable response. Please retry.'); }
}
