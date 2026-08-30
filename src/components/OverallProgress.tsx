import type { ProgressStats } from "../utils/progress";

interface OverallProgressProps {
  stats: ProgressStats;
}

export function OverallProgress({ stats }: OverallProgressProps) {
  return (
    <section className="overall-progress" aria-label="Общий прогресс">
      <div className="overall-top">
        <p className="overall-count">
          <strong>{stats.watched}</strong>
          <span>из&nbsp;{stats.total} в&nbsp;прогрессе</span>
        </p>
        <p className="overall-percent">{stats.percent}%</p>
      </div>
      <div
        className="progress-track progress-track-lg"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={stats.percent}
        aria-label={`Просмотрено ${stats.percent} процентов`}
      >
        <div
          className="progress-fill"
          style={{ clipPath: `inset(0 ${100 - stats.percent}% 0 0 round 999px)` }}
        />
      </div>
      <div className="overall-meta">
        <span>Осталось: {stats.remaining}</span>
        {stats.complete ? <span className="complete-label">Завершено</span> : null}
      </div>
    </section>
  );
}
