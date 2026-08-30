import type { Movie } from "../types/movie";
import { formatOrder, formatYearLine, getBadges } from "../utils/labels";

interface MovieItemProps {
  movie: Movie;
  watched: boolean;
  pending: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}

export function MovieItem({ movie, watched, pending, onToggle, onOpen }: MovieItemProps) {
  const badges = getBadges(movie);
  const yearLine = formatYearLine(movie);
  const disabled = Boolean(movie.future) || pending;
  const checkboxId = `watched-${movie.id}`;

  return (
    <article
      className={`movie-item ${watched ? "is-watched" : ""} ${movie.future ? "is-future" : ""}`}
      aria-busy={pending || undefined}
    >
      <label className="movie-check" htmlFor={checkboxId}>
        <input
          id={checkboxId}
          type="checkbox"
          name={`watched-${movie.id}`}
          checked={watched}
          disabled={disabled}
          onChange={() => onToggle(movie.id)}
          aria-label={
            movie.future
              ? `${movie.title}${movie.season ? `, ${movie.season}` : ""} ещё не вышел`
              : pending
                ? `Сохранение отметки «${movie.title}»`
                : `Отметить «${movie.title}»${movie.season ? `, ${movie.season}` : ""} как просмотренный`
          }
        />
      </label>

      <div className="movie-body">
        <p className="movie-order">{formatOrder(movie.order)}</p>
        <button
          type="button"
          className="movie-title-btn"
          onClick={() => onOpen(movie.id)}
          aria-label={movie.season ? `${movie.title}, ${movie.season}` : movie.title}
        >
          <span className="movie-title">{movie.title}</span>
        </button>
        {movie.originalTitle ? (
          <p className="movie-original" translate="no">
            {movie.originalTitle}
          </p>
        ) : null}
        {yearLine ? <p className="movie-year">{yearLine}</p> : null}
        <div className="badge-row">
          {badges.map((badge) => (
            <span key={badge.key} className={`badge badge-${badge.tone}`}>
              {badge.label}
            </span>
          ))}
        </div>
        {movie.warning ? <p className="movie-warning">{movie.warning}</p> : null}
      </div>
    </article>
  );
}
