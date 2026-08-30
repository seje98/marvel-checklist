import { useCallback, useEffect, useRef } from "react";
import type { Movie } from "../types/movie";
import { formatOrder, formatYearLine, getBadges, TYPE_LABELS } from "../utils/labels";

interface MovieDetailsProps {
  movie: Movie;
  watched: boolean;
  pending: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
}

export function MovieDetails({
  movie,
  watched,
  pending,
  onToggle,
  onClose,
}: MovieDetailsProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const badges = getBadges(movie);
  const yearLine = formatYearLine(movie);
  const titleId = `details-title-${movie.id}`;

  const requestClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || closingRef.current) {
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      onCloseRef.current();
      return;
    }

    closingRef.current = true;
    dialog.setAttribute("data-closing", "");

    let finished = false;
    let fallback = 0;
    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      dialog.removeEventListener("animationend", onAnimationEnd);
      window.clearTimeout(fallback);
      onCloseRef.current();
    };
    const onAnimationEnd = (event: AnimationEvent) => {
      if (event.target === dialog) {
        finish();
      }
    };
    dialog.addEventListener("animationend", onAnimationEnd);
    fallback = window.setTimeout(finish, 240);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (!dialog.open) {
      dialog.showModal();
    }
    const onCancel = (event: Event) => {
      event.preventDefault();
      requestClose();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, [requestClose]);

  return (
    <dialog
      ref={dialogRef}
      className="details-dialog"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          requestClose();
        }
      }}
    >
      <div className="details-shell">
      <div className="details-card">
        <p className="movie-order">#{formatOrder(movie.order)}</p>
        <h2 id={titleId}>{movie.title}</h2>
        {movie.originalTitle ? (
          <p className="movie-original" translate="no">
            {movie.originalTitle}
          </p>
        ) : null}

        <dl className="details-meta">
          {yearLine ? (
            <>
              <dt>Период</dt>
              <dd>{yearLine}</dd>
            </>
          ) : null}
          <dt>Тип</dt>
          <dd>{TYPE_LABELS[movie.type]}</dd>
          {movie.studio ? (
            <>
              <dt>Студия</dt>
              <dd>{movie.studio}</dd>
            </>
          ) : null}
          {movie.universe ? (
            <>
              <dt>Вселенная</dt>
              <dd>{movie.universe}</dd>
            </>
          ) : null}
        </dl>

        <div className="badge-row">
          {badges.map((badge) => (
            <span key={badge.key} className={`badge badge-${badge.tone}`}>
              {badge.label}
            </span>
          ))}
        </div>

        {movie.future ? (
          <p className="details-future">Ещё не вышел — отметить нельзя</p>
        ) : null}

        {movie.warning ? (
          <p className="details-warning">
            <strong>Важно:</strong> {movie.warning}
          </p>
        ) : null}
        {movie.notes ? <p className="details-notes">{movie.notes}</p> : null}

        <div className="details-actions">
          {movie.future ? null : pending ? (
            <button type="button" className="primary-btn" disabled aria-busy="true">
              <span>Сохранение:</span>
              <span className="btn-glyph" aria-hidden="true">
                <span className="btn-spinner" />
              </span>
            </button>
          ) : watched ? (
            <button
              type="button"
              className="ghost-btn details-unwatch"
              onClick={() => onToggle(movie.id)}
            >
              Снять отметку
            </button>
          ) : (
            <button
              type="button"
              className="primary-btn"
              onClick={() => onToggle(movie.id)}
            >
              <span>Отметить просмотренным</span>
              <span className="btn-glyph" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3.5 8.4l3 3.1 6-6.5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
          )}
          <button type="button" className="ghost-btn details-dismiss" onClick={requestClose}>
            Закрыть
          </button>
        </div>
      </div>
      </div>
    </dialog>
  );
}
