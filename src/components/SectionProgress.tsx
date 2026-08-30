import type { ProgressStats } from "../utils/progress";

interface SectionProgressProps {
  section: number;
  title: string;
  stats: ProgressStats;
  collapsed: boolean;
  onToggle: () => void;
}

export function SectionProgress({
  section,
  title,
  stats,
  collapsed,
  onToggle,
}: SectionProgressProps) {
  const futureOnly = stats.total === 0;

  return (
    <button
      type="button"
      className={`section-head${collapsed ? " is-collapsed" : ""}`}
      onClick={onToggle}
      aria-expanded={!collapsed}
    >
      <div className="section-copy">
        <p className="section-kicker">Часть {section}</p>
        <span className="section-title-row">
          <h2 className="section-title">{title}</h2>
          <span className="section-chevron" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none">
              <path
                d="M3.75 6.25L8 10.5l4.25-4.25"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </span>
      </div>
      <div className="section-stats">
        {futureOnly ? (
          <p className="section-future-note">Ещё не вышли</p>
        ) : (
          <>
            <p>
              {stats.watched}&nbsp;/&nbsp;{stats.total}
              {stats.complete ? (
                <span className="complete-label"> Завершено</span>
              ) : null}
            </p>
            <p className="section-percent">{stats.percent}%</p>
            <div
              className="progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={stats.percent}
              aria-label={`Часть ${section}: ${stats.percent} процентов`}
            >
              <div
                className="progress-fill"
                style={{ clipPath: `inset(0 ${100 - stats.percent}% 0 0 round 999px)` }}
              />
            </div>
          </>
        )}
      </div>
    </button>
  );
}
