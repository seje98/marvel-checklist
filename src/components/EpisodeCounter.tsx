import { useEffect, useState } from "react";

interface EpisodeCounterProps {
  id: string;
  title: string;
  watched: number;
  total: number;
  disabled?: boolean;
  onChange: (count: number) => void;
}

export function EpisodeCounter({
  id,
  title,
  watched,
  total,
  disabled = false,
  onChange,
}: EpisodeCounterProps) {
  const [draft, setDraft] = useState(String(watched));
  const percent = Math.round((watched / total) * 100);
  const inputId = `episodes-${id}`;

  useEffect(() => {
    setDraft(String(watched));
  }, [watched]);

  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    if (Number.isNaN(parsed)) {
      setDraft(String(watched));
      return;
    }
    const next = Math.min(Math.max(parsed, 0), total);
    setDraft(String(next));
    if (next !== watched) {
      onChange(next);
    }
  };

  return (
    <div className="episode-counter" role="group" aria-label={`Серии «${title}»`}>
      <div className="episode-controls">
        <button
          type="button"
          className="episode-step"
          disabled={disabled || watched <= 0}
          onClick={() => onChange(watched - 1)}
          aria-label="Убрать одну просмотренную серию"
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <div className="episode-value">
          <label className="sr-only" htmlFor={inputId}>
            Просмотрено серий
          </label>
          <input
            id={inputId}
            className="episode-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={draft}
            disabled={disabled}
            onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
            onFocus={(event) => event.target.select()}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                setDraft(String(watched));
                event.currentTarget.blur();
              }
            }}
          />
          <span className="episode-total">из&nbsp;{total}</span>
        </div>

        <button
          type="button"
          className="episode-step"
          disabled={disabled || watched >= total}
          onClick={() => onChange(watched + 1)}
          aria-label="Добавить одну просмотренную серию"
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3.5 8h9M8 3.5v9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div
        className="episode-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={watched}
        aria-valuetext={`${watched} из ${total} серий`}
        aria-label={`Просмотрено серий «${title}»`}
      >
        <div
          className="progress-fill"
          style={{ clipPath: `inset(0 ${100 - percent}% 0 0 round 999px)` }}
        />
      </div>
    </div>
  );
}
