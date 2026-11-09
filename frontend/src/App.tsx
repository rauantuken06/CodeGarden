import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { RepoForm } from './components/RepoForm';
import { GardenCanvas } from './components/GardenCanvas';
import { GardenStats } from './components/GardenStats';
import { Icon, PixelLogo } from './components/Icons';
import { DEMO_GARDEN } from './data/demo';
import { fetchGarden } from './api';
import type { GardenResponse } from './types';

export default function App() {
  const [repo, setRepo] = useState('');
  const [result, setResult] = useState<GardenResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapshotRef = useRef<(() => void) | null>(null);
  const handleCanvas = useCallback((canvas: HTMLCanvasElement | null) => { canvasRef.current = canvas; }, []);
  const handleSnapshot = useCallback((snapshot: (() => void) | null) => { snapshotRef.current = snapshot; }, []);
  useEffect(() => () => request.current?.abort(), []);

  const isDemo = result === null;
  const garden = result?.garden ?? DEMO_GARDEN;
  const gardenName = result ? `${result.repository.full_name} Garden` : 'Demo Garden';
  const scrollBehavior = (): ScrollBehavior => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

  async function analyze() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    try {
      const response = await fetchGarden(repo, controller.signal);
      if (controller.signal.aborted) return;
      setResult(response);
      document.querySelector('#garden')?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to grow this garden.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  const grow = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void analyze();
  };
  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    snapshotRef.current?.();
    canvas.toBlob(blob => {
      if (!blob) { setError('Your browser could not export this garden.'); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${gardenName.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}.png`;
      link.href = url;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  };
  const reset = () => {
    request.current?.abort();
    setLoading(false);
    setRepo('');
    setError('');
    setResult(null);
    document.querySelector<HTMLInputElement>('#repository')?.focus();
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  };
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#" aria-label="CodeGarden home">
          <PixelLogo />
          <span>CodeGarden</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#garden">The Garden</a>
          <a href="#how">How it works</a>
          <a href={result?.repository.html_url ?? "https://github.com"} target="_blank" rel="noreferrer" className="github-link">
            <Icon name="github" /> GitHub
          </a>
        </nav>
      </header>

      <section className="hero">
        <div className="eyebrow">
          <Icon name="spark" /> YOUR CODE, IN FULL BLOOM
        </div>
        <h1>
          Every Commit
          <br />
          <em>Grows Something.</em>
        </h1>
        <p>Turn your GitHub history into a little world of your own.</p>
        <RepoForm value={repo} loading={loading} invalid={Boolean(error)} onChange={setRepo} onSubmit={grow} />
        {error && <div className="request-error" role="alert">{error} <button type="button" onClick={() => void analyze()}>Try again</button></div>}
        {loading && <p className="request-status" role="status">Reading your repository and growing its garden…</p>}

      </section>

      <section className="garden-section" id="garden">
        <GardenCanvas garden={garden} label={gardenName} demo={isDemo} onCanvas={handleCanvas} onSnapshot={handleSnapshot} />
        <GardenStats garden={garden} repository={result?.repository ?? null} demo={isDemo} />
        <div className="garden-actions">
          <button className="button-secondary" onClick={download}>
            <Icon name="download" /> Download as PNG
          </button>
          {!isDemo && <button className="button-quiet" onClick={() => void analyze()} disabled={loading}>Refresh garden</button>}
          <button className="button-quiet" onClick={reset}>
            Analyze another repository <Icon name="arrow" />
          </button>
        </div>
      </section>

      <section className="how" id="how">
        <div className="section-heading">
          <span>HOW IT WORKS</span>
          <h2>
            From commit log to <em>living landscape.</em>
          </h2>
        </div>
        <div className="steps">
          <article>
            <span className="step-num">01</span>
            <div className="step-art art-commits" />
            <h3>We read the seasons</h3>
            <p>We read up to 300 commits from your public repository’s default branch and group them by month.</p>
          </article>
          <article>
            <span className="step-num">02</span>
            <div className="step-art art-grow" />
            <h3>Your work takes root</h3>
            <p>Each active month grows a plant. More commits grow taller trees; fix-prefixed commits bloom as flowers.</p>
          </article>
          <article>
            <span className="step-num">03</span>
            <div className="step-art art-share" />
            <h3>Keep or share it</h3>
            <p>Download your garden as crisp pixel art and let your work live beyond the graph.</p>
          </article>
        </div>
      </section>

      <footer>
        <a className="brand" href="#">
          <PixelLogo />
          <span>CodeGarden</span>
        </a>
        <p>Made for developers who keep growing.</p>
        <span>Built with Python &amp; React</span>
      </footer>
    </main>
  );
}
