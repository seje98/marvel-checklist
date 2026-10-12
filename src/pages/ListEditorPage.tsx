import { useMemo, useState } from "react";
import { Header } from "../components/Header";
import { MovieFormDialog } from "../components/MovieFormDialog";
import type { useMovies } from "../hooks/useMovies";
import { useRowDrag } from "../hooks/useRowDrag";
import type { Movie } from "../types/movie";
import { matchesSearch } from "../utils/filters";
import { formatOrder, TYPE_LABELS } from "../utils/labels";

interface ListEditorPageProps {
  moviesState: ReturnType<typeof useMovies>;
}

type FormTarget = { mode: "new" } | { mode: "edit"; id: string };

export function ListEditorPage({ moviesState }: ListEditorPageProps) {
  const {
    movies,
    readOnly,
    loading,
    error,
    refresh,
    saveMovie,
    moveMovie,
    removeMovie,
  } = moviesState;

  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormTarget | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const visible = useMemo(
    () => movies.filter((movie) => matchesSearch(movie, query)),
    [movies, query],
  );
  const filtering = query.trim() !== "";
  const editingMovie =
    form?.mode === "edit" ? movies.find((movie) => movie.id === form.id) : undefined;

  const run = async (id: string, task: () => Promise<unknown>, message: string) => {
    setBusyId(id);
    setActionError(null);
    try {
      await task();
    } catch {
      setActionError(message);
    } finally {
      setBusyId(null);
    }
  };

  const moveTo = (id: string, position: number) =>
    run(
      id,
      () => moveMovie(id, position),
      "Не удалось изменить порядок. Список обновлён с сервера.",
    );

  // Клавиатура: стрелки вверх и вниз на ручке сдвигают проект на одну позицию.
  const moveByKey = async (movie: Movie, index: number, delta: -1 | 1) => {
    const position = delta < 0 ? index : index + 2;
    if (position < 1 || position > movies.length) {
      return;
    }
    await moveTo(movie.id, position);
    document.querySelector<HTMLElement>(`[data-handle-id="${CSS.escape(movie.id)}"]`)?.focus();
  };

  const remove = (movie: Movie) => {
    setConfirmId(null);
    return run(
      movie.id,
      () => removeMovie(movie.id),
      "Не удалось удалить проект. Список обновлён с сервера.",
    );
  };

  const busy = busyId !== null || readOnly;

  const { listRef, drag, getHandleProps } = useRowDrag({
    disabled: busy || filtering,
    onDrop: (id, position) => void moveTo(id, position),
  });

  return (
    <div className="app-shell">
      <a className="skip-link" href="#editor-list">
        Перейти к списку проектов
      </a>
      <Header link={{ route: "home", label: "К чек-листу" }} />

      <section className="editor-bar" aria-label="Управление списком">
        <div className="editor-search search-wrap">
          <div className="search-core">
            <label className="sr-only" htmlFor="editor-search">
              Поиск по списку проектов
            </label>
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="6.25" stroke="currentColor" strokeWidth="1.25" />
              <path
                d="M16.2 16.2L21 21"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
              />
            </svg>
            <input
              id="editor-search"
              className="search-input"
              type="search"
              placeholder="Найти проект"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>
        <button
          type="button"
          className="primary-btn editor-add"
          onClick={() => setForm({ mode: "new" })}
          disabled={readOnly}
        >
          <span>Добавить проект</span>
          <span className="btn-glyph" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none">
              <path
                d="M8 3.5v9M3.5 8h9"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </button>
      </section>

      <p className="editor-count" aria-live="polite">
        {filtering ? `Найдено ${visible.length} из ${movies.length}` : `Проектов: ${movies.length}`}
        {filtering ? ". Перемещение недоступно при поиске." : ""}
      </p>

      {error ? (
        <p className="banner banner-warning" role="status">
          {error}{" "}
          <button type="button" className="link-btn" onClick={() => void refresh()}>
            Повторить
          </button>
        </p>
      ) : null}
      {readOnly ? (
        <p className="banner banner-warning" role="status">
          В Mokky у записей нет числового id, поэтому список доступен только для чтения.
          Очистите коллекцию movies и загрузите список заново командой{" "}
          <code>node scripts/export-for-mokky.mjs --upload &lt;адрес&gt;/movies</code>.
        </p>
      ) : null}
      {actionError ? (
        <p className="banner banner-warning" role="alert">
          {actionError}
        </p>
      ) : null}

      <main id="editor-list" className="editor-list">
        {loading && movies.length === 0 ? (
          <p className="loading-label" aria-busy="true">
            Загрузка списка:
          </p>
        ) : visible.length === 0 ? (
          <div className="empty-shell">
            <p className="empty-state">
              {movies.length === 0
                ? "Список пуст. Добавьте первый проект."
                : "Ничего не найдено."}
            </p>
          </div>
        ) : (
          <ul
            ref={listRef}
            className={drag ? "editor-rows is-sorting" : "editor-rows"}
          >
            {visible.map((movie) => {
              const index = movies.indexOf(movie);
              const rowBusy = busyId === movie.id;
              const confirming = confirmId === movie.id;
              const dragging = drag?.id === movie.id;
              const shift = drag ? (dragging ? drag.offset : (drag.shifts[movie.id] ?? 0)) : 0;
              const rowClass = [
                "editor-row",
                dragging ? "is-dragging" : "",
                dragging && drag?.settling ? "is-settling" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <li
                  key={movie.id}
                  data-row-id={movie.id}
                  className={rowClass}
                  style={drag ? { transform: `translateY(${shift}px)` } : undefined}
                  aria-busy={rowBusy || undefined}
                >
                  <button
                    type="button"
                    className="editor-handle"
                    data-handle-id={movie.id}
                    aria-label={`Переместить: ${movie.title}. Стрелки вверх и вниз меняют порядок`}
                    disabled={busy || filtering}
                    title={filtering ? "Перемещение недоступно при поиске" : "Перетащите, чтобы изменить порядок"}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                        event.preventDefault();
                        void moveByKey(movie, index, event.key === "ArrowUp" ? -1 : 1);
                      }
                    }}
                    {...getHandleProps(movie.id)}
                  >
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M3 4.5h10M3 8h10M3 11.5h10"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                  <span className="editor-order">#{formatOrder(movie.order)}</span>
                  <div className="editor-main">
                    <p className="editor-title">
                      {movie.title}
                      {movie.season ? <span className="editor-season"> · {movie.season}</span> : null}
                    </p>
                    <p className="editor-meta">
                      {TYPE_LABELS[movie.type]} · {movie.section}. {movie.sectionTitle}
                      {movie.future ? " · Ещё не вышел" : ""}
                    </p>
                  </div>

                  {confirming ? (
                    <div className="editor-actions" role="group" aria-label="Подтверждение удаления">
                      <span className="editor-confirm">Удалить?</span>
                      <button
                        type="button"
                        className="ghost-btn editor-danger"
                        onClick={() => void remove(movie)}
                        disabled={busy}
                      >
                        Да
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => setConfirmId(null)}
                      >
                        Нет
                      </button>
                    </div>
                  ) : (
                    <div className="editor-actions">
                      <button
                        type="button"
                        className="ghost-btn editor-icon-btn"
                        aria-label={`Изменить: ${movie.title}`}
                        title="Изменить"
                        onClick={() => setForm({ mode: "edit", id: movie.id })}
                        disabled={busy}
                      >
                        <span className="icon icon-edit" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="ghost-btn editor-icon-btn editor-danger"
                        aria-label={`Удалить: ${movie.title}`}
                        title="Удалить"
                        onClick={() => setConfirmId(movie.id)}
                        disabled={busy}
                      >
                        <span className="icon icon-delete" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {form && (form.mode === "new" || editingMovie) ? (
        <MovieFormDialog
          key={form.mode === "edit" ? form.id : "new"}
          movie={editingMovie}
          movies={movies}
          onSubmit={async (input) => {
            await saveMovie(input);
          }}
          onClose={() => setForm(null)}
        />
      ) : null}
    </div>
  );
}
