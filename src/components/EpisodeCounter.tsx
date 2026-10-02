import { useEffect, useState } from "react";

interface EpisodeCounterProps {
  id: string;
  title: string;
  /** Номер первой серии записи (для «S1 E08–E22» это 8). */
  first: number;
  /** Номер последней серии записи (для «S1 E08–E22» это 22). */
  last: number;
  /** Сколько серий записи просмотрено (0 … last − first + 1). */
  watched: number;
  disabled?: boolean;
  onChange: (count: number) => void;
}

export function EpisodeCounter({
  id,
  title,
  first,
  last,
  watched,
  disabled = false,
  onChange,
}: EpisodeCounterProps) {
  // Показываем номер последней просмотренной серии. Пока ничего не просмотрено,
  // это номер серии перед первой (0 для целого сезона, 7 для E08–E22).
  const base = first - 1;
  const total = last - base;
  const current = base + watched;
  const percent = Math.round((watched / total) * 100);
  const [draft, setDraft] = useState(String(current));
  const inputId = `episodes-${id}`;

  useEffect(() => {
    setDraft(String(current));
  }, [current]);

  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    if (Number.isNaN(parsed)) {
      setDraft(String(current));
      return;
    }
    const next = Math.min(Math.max(parsed, base), last);
    setDraft(String(next));
    if (next !== current) {
      onChange(next - base);
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
            Последняя просмотренная серия
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
                setDraft(String(current));
                event.currentTarget.blur();
              }
            }}
          />
          <span className="episode-total">из&nbsp;{last}</span>
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
        aria-valuemin={base}
        aria-valuemax={last}
        aria-valuenow={current}
        aria-valuetext={`Просмотрено до серии ${current} из ${last}`}
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
