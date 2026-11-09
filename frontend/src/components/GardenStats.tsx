import type { GardenData, RepositoryMetadata } from '../types';

export function GardenStats({ garden, repository, demo }: {
  garden: GardenData; repository: RepositoryMetadata | null; demo: boolean;
}) {
  const stats = [
    [garden.total_analyzed_commits, 'commits analyzed'],
    [garden.plants.length, 'plants displayed'],
    [garden.active_months, 'active months'],
    [garden.bug_fix_count, 'bug-fix commits'],
  ] as const;
  return <>
    <div className="stats">
      {stats.map(([value, label], index) => <div className="stat" key={label}>
        <span className={`stat-icon stat-icon-${index}`} aria-hidden="true" />
        <div><strong>{value.toLocaleString('en-US')}</strong><small>{label}</small></div>
      </div>)}
    </div>
    <div className="garden-notes" aria-live="polite">
      {demo ? <p><strong>Demo Garden</strong> · Local example data. Analyze a repository to see real GitHub activity.</p> : repository && <>
        <p className="repository-details"><a href={repository.html_url} target="_blank" rel="noreferrer">{repository.full_name}</a> · {repository.stars.toLocaleString('en-US')} stars · Branch: {repository.default_branch}</p>
        {repository.description && <p>{repository.description}</p>}
      </>}
      {!demo && garden.total_analyzed_commits === 0 && <p role="status"><strong>No commits yet.</strong> This public repository is empty. Your island is ready for its first plant.</p>}
      {garden.truncated && <p className="history-notice" role="status">Partial history: statistics cover only the {garden.total_analyzed_commits} analyzed commits, not the repository’s complete history.</p>}
      <p>Up to {garden.plant_display_limit} latest active months and {garden.flower_display_limit} bug-fix flowers are displayed.
        {garden.hidden_plants > 0 && ` ${garden.hidden_plants} earlier monthly plants are hidden.`}
        {garden.hidden_flowers > 0 && ` ${garden.hidden_flowers} additional flowers are hidden.`}
        {' '}Statistics include all analyzed commits.</p>
    </div>
  </>;
}
