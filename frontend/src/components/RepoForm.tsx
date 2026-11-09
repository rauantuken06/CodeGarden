import type { FormEvent } from 'react';
import { Icon } from './Icons';
interface Props {
  value: string;
  loading: boolean;
  invalid: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}
export function RepoForm({ value, loading, invalid, onChange, onSubmit }: Props) {
  return (
        <form className="repo-form" onSubmit={onSubmit}>
          <label htmlFor="repository">GitHub repository URL</label>
          <div className="input-wrap">
            <Icon name="github" />
            <input
              id="repository"
              type="url"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://github.com/you/your-project"
              aria-describedby="repository-help"
              aria-invalid={invalid}
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="loading-sprout" />
                  Growing…
                </>
              ) : (
                <>
                  Grow My Garden <Icon name="arrow" />
                </>
              )}
            </button>
          </div>
          <small id="repository-help">No sign-in needed. Try any public repository.</small>
        </form>
  );
}
