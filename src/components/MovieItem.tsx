import { useEffect, useRef } from "react";
import type { Movie } from "../types/movie";
import { formatOrder, formatYearLine, getBadges } from "../utils/labels";
import { getEpisodeRange, hasEpisodes } from "../utils/progress";
import { EpisodeCounter } from "./EpisodeCounter";

interface MovieItemProps {
  movie: Movie;
  watched: boolean;
  watchedEpisodes: number;
  pending: boolean;
  onToggle: (id: string) => void;
  onSetEpisodes: (id: string, count: number) => void;
  onOpen: (id: string) => void;
}

export function MovieItem({
  movie,
  watched,
  watchedEpisodes,
  pending,
  onToggle,
  onSetEpisodes,
  onOpen,
}: MovieItemProps) {
  const badges = getBadges(movie);
  const yearLine = formatYearLine(movie);
  const disabled = Boolean(movie.future) || pending;
  const checkboxId = `watched-${movie.id}`;
  const checkboxRef = useRef<HTMLInputElement>(null);
  const showEpisodes = hasEpisodes(movie) && !movie.future;
  const partial = showEpisodes && !watched && watchedEpisodes > 0;

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = partial;
    }
  }, [partial, watched]);

  return (
    <article
      className={`movie-item ${watched ? "is-watched" : ""} ${movie.future ? "is-future" : ""}`}
      aria-busy={pending || undefined}
    >
      <label className="movie-check" htmlFor={checkboxId}>
        <input
          ref={checkboxRef}
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
                : partial
                  ? `Отметить «${movie.title}»${movie.season ? `, ${movie.season}` : ""} просмотренным целиком`
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
        {showEpisodes ? (
          <EpisodeCounter
            id={movie.id}
            title={movie.season ? `${movie.title}, ${movie.season}` : movie.title}
            {...getEpisodeRange(movie)}
            watched={watchedEpisodes}
            disabled={pending}
            onChange={(count) => onSetEpisodes(movie.id, count)}
          />
        ) : null}
        {movie.warning ? <p className="movie-warning">{movie.warning}</p> : null}
      </div>
    </article>
  );
}
