import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { MovieDraft } from "../api/movies";
import type { SaveMovieInput } from "../hooks/useMovies";
import {
  MOVIE_TAGS,
  MOVIE_TYPES,
  type Movie,
  type MovieTag,
  type MovieType,
} from "../types/movie";
import { TYPE_LABELS } from "../utils/labels";
import { Select } from "./Select";
import { SLUG_PATTERN, suggestSlug } from "../utils/slug";

const TAG_LABELS: Record<MovieTag, string> = {
  required: "Обязательно",
  recommended: "Желательно",
  optional: "Необязательно",
  multiverse: "Мультивселенная",
  tv: "TV",
  legacy: "Legacy",
  future: "Будущее",
};

const EPISODE_TYPES: readonly MovieType[] = ["series", "animation"];
const NEW_SECTION = "new";

interface FormState {
  slug: string;
  title: string;
  originalTitle: string;
  type: MovieType;
  tags: MovieTag[];
  future: boolean;
  section: string;
  sectionTitle: string;
  timeline: string;
  releaseYear: string;
  releaseDate: string;
  season: string;
  episodes: string;
  studio: string;
  universe: string;
  notes: string;
  warning: string;
  position: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

interface MovieFormDialogProps {
  /** Редактируемый проект; без него форма создаёт новый. */
  movie?: Movie;
  movies: Movie[];
  onSubmit: (input: SaveMovieInput) => Promise<void>;
  onClose: () => void;
}

function toState(movie: Movie | undefined, movies: Movie[]): FormState {
  if (!movie) {
    const lastSection = movies[movies.length - 1];
    return {
      slug: "",
      title: "",
      originalTitle: "",
      type: "movie",
      tags: ["recommended"],
      future: false,
      section: lastSection ? String(lastSection.section) : "1",
      sectionTitle: lastSection ? lastSection.sectionTitle : "",
      timeline: "",
      releaseYear: "",
      releaseDate: "",
      season: "",
      episodes: "",
      studio: "",
      universe: "",
      notes: "",
      warning: "",
      position: String(movies.length + 1),
    };
  }

  return {
    slug: movie.id,
    title: movie.title,
    originalTitle: movie.originalTitle ?? "",
    type: movie.type,
    tags: movie.tags.filter((tag) => tag !== "future"),
    future: movie.future === true || movie.tags.includes("future"),
    section: String(movie.section),
    sectionTitle: movie.sectionTitle,
    timeline: movie.timeline ?? "",
    releaseYear: movie.releaseYear === undefined ? "" : String(movie.releaseYear),
    releaseDate: movie.releaseDate ?? "",
    season: movie.season ?? "",
    episodes: movie.episodes === undefined ? "" : String(movie.episodes),
    studio: movie.studio ?? "",
    universe: movie.universe ?? "",
    notes: movie.notes ?? "",
    warning: movie.warning ?? "",
    position: String(movies.findIndex((item) => item.id === movie.id) + 1),
  };
}

function validate(state: FormState, movies: Movie[], editing: boolean): Errors {
  const errors: Errors = {};

  if (!state.title.trim()) {
    errors.title = "Укажите название";
  }

  if (!editing) {
    if (!SLUG_PATTERN.test(state.slug)) {
      errors.slug = "Только латиница, цифры и дефисы, например iron-man-2008";
    } else if (movies.some((movie) => movie.id === state.slug)) {
      errors.slug = "Проект с таким идентификатором уже есть";
    }
  }

  const section = Number(state.section);
  if (!Number.isInteger(section) || section < 1) {
    errors.section = "Целое число от 1";
  }
  if (!state.sectionTitle.trim()) {
    errors.sectionTitle = "Укажите название раздела";
  }

  if (state.releaseYear.trim()) {
    const year = Number(state.releaseYear);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      errors.releaseYear = "Год от 1900 до 2100";
    }
  }

  if (EPISODE_TYPES.includes(state.type) && state.episodes.trim()) {
    const episodes = Number(state.episodes);
    if (!Number.isInteger(episodes) || episodes < 1) {
      errors.episodes = "Целое число от 1";
    }
  }

  const position = Number(state.position);
  if (!Number.isInteger(position) || position < 1) {
    errors.position = "Целое число от 1";
  }

  return errors;
}

function buildDraft(state: FormState): Omit<MovieDraft, "order"> {
  const text = (value: string) => value.trim() || undefined;
  const tags = state.future
    ? [...state.tags.filter((tag) => tag !== "future"), "future" as const]
    : state.tags.filter((tag) => tag !== "future");

  const draft: Omit<MovieDraft, "order"> = {
    id: state.slug,
    title: state.title.trim(),
    type: state.type,
    tags,
    section: Number(state.section),
    sectionTitle: state.sectionTitle.trim(),
  };

  const originalTitle = text(state.originalTitle);
  const timeline = text(state.timeline);
  const releaseDate = text(state.releaseDate);
  const studio = text(state.studio);
  const universe = text(state.universe);
  const notes = text(state.notes);
  const warning = text(state.warning);

  if (originalTitle) draft.originalTitle = originalTitle;
  if (timeline) draft.timeline = timeline;
  if (releaseDate) draft.releaseDate = releaseDate;
  if (studio) draft.studio = studio;
  if (universe) draft.universe = universe;
  if (notes) draft.notes = notes;
  if (warning) draft.warning = warning;
  if (state.releaseYear.trim()) draft.releaseYear = Number(state.releaseYear);
  if (state.future) draft.future = true;

  if (EPISODE_TYPES.includes(state.type)) {
    const season = text(state.season);
    if (season) draft.season = season;
    if (state.episodes.trim()) draft.episodes = Number(state.episodes);
  }

  return draft;
}

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  wide?: boolean;
  children: ReactNode;
}

function Field({ id, label, error, hint, wide, children }: FieldProps) {
  return (
    <div className={wide ? "field field-wide" : "field"}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function MovieFormDialog({
  movie,
  movies,
  onSubmit,
  onClose,
}: MovieFormDialogProps) {
  const editing = movie !== undefined;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [state, setState] = useState(() => toState(movie, movies));
  const [slugTouched, setSlugTouched] = useState(editing);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sections = useMemo(() => {
    const byNumber = new Map<number, string>();
    for (const item of movies) {
      if (!byNumber.has(item.section)) {
        byNumber.set(item.section, item.sectionTitle);
      }
    }
    return [...byNumber].sort((a, b) => a[0] - b[0]);
  }, [movies]);

  const typeOptions = useMemo(
    () => MOVIE_TYPES.map((type) => ({ value: type, label: TYPE_LABELS[type] })),
    [],
  );

  const sectionOptions = useMemo(
    () => [
      ...sections.map(([number, sectionTitle]) => ({
        value: String(number),
        label: `${number}. ${sectionTitle}`,
      })),
      { value: NEW_SECTION, label: "Новый раздел" },
    ],
    [sections],
  );

  const requestClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || closingRef.current) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onCloseRef.current();
      return;
    }
    closingRef.current = true;
    dialog.setAttribute("data-closing", "");
    window.setTimeout(() => onCloseRef.current(), 160);
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
      // Escape в открытом выпадающем списке закрывает только его.
      if (dialog.querySelector(".select-trigger[data-open]")) {
        return;
      }
      requestClose();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, [requestClose]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((current) => {
      const next = { ...current, [key]: value };
      if (
        !slugTouched &&
        (key === "title" || key === "originalTitle" || key === "releaseYear")
      ) {
        next.slug = suggestSlug(next.title, next.originalTitle, next.releaseYear);
      }
      return next;
    });
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const toggleTag = (tag: MovieTag) => {
    setState((current) => ({
      ...current,
      tags: current.tags.includes(tag)
        ? current.tags.filter((item) => item !== tag)
        : [...current.tags, tag],
    }));
  };

  const pickSection = (value: string) => {
    if (value === NEW_SECTION) {
      const next = sections.length > 0 ? sections[sections.length - 1][0] + 1 : 1;
      setState((current) => ({ ...current, section: String(next), sectionTitle: "" }));
      return;
    }
    const found = sections.find(([number]) => String(number) === value);
    if (found) {
      setState((current) => ({
        ...current,
        section: String(found[0]),
        sectionTitle: found[1],
      }));
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) {
      return;
    }

    const found = validate(state, movies, editing);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = dialogRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      first?.focus();
      return;
    }

    setBusy(true);
    setSubmitError(null);
    try {
      await onSubmit({
        existingId: movie?.id,
        draft: buildDraft(state),
        position: Number(state.position),
      });
      requestClose();
    } catch {
      setSubmitError("Не удалось сохранить. Проверьте соединение и повторите.");
      setBusy(false);
    }
  };

  const sectionKnown = sections.some(
    ([number, title]) => String(number) === state.section && title === state.sectionTitle,
  );
  const supportsEpisodes = EPISODE_TYPES.includes(state.type);
  const title = editing ? "Изменить проект" : "Новый проект";

  const inputProps = (key: keyof FormState, extra?: { hint?: boolean }) => ({
    id: `form-${key}`,
    className: "field-input",
    "aria-invalid": errors[key] ? (true as const) : undefined,
    "aria-describedby": errors[key]
      ? `form-${key}-error`
      : extra?.hint
        ? `form-${key}-hint`
        : undefined,
  });

  return (
    <dialog
      ref={dialogRef}
      className="details-dialog form-dialog"
      aria-labelledby="form-dialog-title"
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          requestClose();
        }
      }}
    >
      <div className="details-shell">
        <form className="details-card" onSubmit={handleSubmit} noValidate>
          <h2 id="form-dialog-title">{title}</h2>

          <div className="form-grid">
            <Field id="form-title" label="Название" error={errors.title} wide>
              <input
                {...inputProps("title")}
                type="text"
                value={state.title}
                onChange={(event) => update("title", event.target.value)}
                autoComplete="off"
                required
              />
            </Field>

            <Field id="form-originalTitle" label="Оригинальное название" wide>
              <input
                {...inputProps("originalTitle")}
                type="text"
                value={state.originalTitle}
                onChange={(event) => update("originalTitle", event.target.value)}
                autoComplete="off"
                translate="no"
              />
            </Field>

            <Field
              id="form-slug"
              label="Идентификатор"
              error={errors.slug}
              hint={
                editing
                  ? "Не меняется: к нему привязаны отметки просмотра"
                  : "Латиница и дефисы, формируется из названия"
              }
              wide
            >
              <input
                {...inputProps("slug", { hint: true })}
                type="text"
                value={state.slug}
                readOnly={editing}
                onChange={(event) => {
                  setSlugTouched(true);
                  update("slug", event.target.value.trim().toLowerCase());
                }}
                autoComplete="off"
                spellCheck={false}
                translate="no"
              />
            </Field>

            <Field id="form-type" label="Тип">
              <Select
                id="form-type"
                value={state.type}
                options={typeOptions}
                onChange={(value) => update("type", value as MovieType)}
              />
            </Field>

            <Field
              id="form-position"
              label="Позиция в списке"
              error={errors.position}
              hint={`От 1 до ${editing ? movies.length : movies.length + 1}`}
            >
              <input
                {...inputProps("position", { hint: true })}
                type="number"
                inputMode="numeric"
                min={1}
                value={state.position}
                onChange={(event) => update("position", event.target.value)}
              />
            </Field>

            <fieldset className="field field-wide field-set">
              <legend className="field-label">Теги</legend>
              <div className="chip-row">
                {MOVIE_TAGS.filter((tag) => tag !== "future").map((tag) => (
                  <label
                    key={tag}
                    className={state.tags.includes(tag) ? "chip chip-active" : "chip"}
                  >
                    <input
                      type="checkbox"
                      checked={state.tags.includes(tag)}
                      onChange={() => toggleTag(tag)}
                    />
                    {TAG_LABELS[tag]}
                  </label>
                ))}
                <label className={state.future ? "chip chip-active" : "chip"}>
                  <input
                    type="checkbox"
                    checked={state.future}
                    onChange={(event) => update("future", event.target.checked)}
                  />
                  Ещё не вышел
                </label>
              </div>
            </fieldset>

            <Field id="form-sectionPick" label="Раздел" wide>
              <Select
                id="form-sectionPick"
                value={sectionKnown ? state.section : NEW_SECTION}
                options={sectionOptions}
                onChange={pickSection}
              />
            </Field>

            <Field id="form-section" label="Номер раздела" error={errors.section}>
              <input
                {...inputProps("section")}
                type="number"
                inputMode="numeric"
                min={1}
                value={state.section}
                onChange={(event) => update("section", event.target.value)}
              />
            </Field>

            <Field
              id="form-sectionTitle"
              label="Название раздела"
              error={errors.sectionTitle}
            >
              <input
                {...inputProps("sectionTitle")}
                type="text"
                value={state.sectionTitle}
                onChange={(event) => update("sectionTitle", event.target.value)}
                autoComplete="off"
              />
            </Field>

            <Field id="form-timeline" label="Период в хронологии">
              <input
                {...inputProps("timeline")}
                type="text"
                value={state.timeline}
                onChange={(event) => update("timeline", event.target.value)}
                autoComplete="off"
              />
            </Field>

            <Field id="form-releaseYear" label="Год выхода" error={errors.releaseYear}>
              <input
                {...inputProps("releaseYear")}
                type="number"
                inputMode="numeric"
                value={state.releaseYear}
                onChange={(event) => update("releaseYear", event.target.value)}
              />
            </Field>

            <Field id="form-releaseDate" label="Дата выхода">
              <input
                {...inputProps("releaseDate")}
                type="text"
                value={state.releaseDate}
                onChange={(event) => update("releaseDate", event.target.value)}
                autoComplete="off"
              />
            </Field>

            <Field id="form-studio" label="Студия">
              <input
                {...inputProps("studio")}
                type="text"
                value={state.studio}
                onChange={(event) => update("studio", event.target.value)}
                autoComplete="off"
              />
            </Field>

            <Field id="form-universe" label="Вселенная" wide>
              <input
                {...inputProps("universe")}
                type="text"
                value={state.universe}
                onChange={(event) => update("universe", event.target.value)}
                autoComplete="off"
              />
            </Field>

            {supportsEpisodes ? (
              <>
                <Field
                  id="form-season"
                  label="Сезон"
                  hint="Например: S1 E08–E16"
                >
                  <input
                    {...inputProps("season", { hint: true })}
                    type="text"
                    value={state.season}
                    onChange={(event) => update("season", event.target.value)}
                    autoComplete="off"
                  />
                </Field>
                <Field id="form-episodes" label="Серий" error={errors.episodes}>
                  <input
                    {...inputProps("episodes")}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={state.episodes}
                    onChange={(event) => update("episodes", event.target.value)}
                  />
                </Field>
              </>
            ) : null}

            <Field id="form-warning" label="Важно (предупреждение)" wide>
              <textarea
                {...inputProps("warning")}
                rows={2}
                value={state.warning}
                onChange={(event) => update("warning", event.target.value)}
              />
            </Field>

            <Field id="form-notes" label="Примечание" wide>
              <textarea
                {...inputProps("notes")}
                rows={3}
                value={state.notes}
                onChange={(event) => update("notes", event.target.value)}
              />
            </Field>
          </div>

          {submitError ? (
            <p className="field-error form-error" role="alert">
              {submitError}
            </p>
          ) : null}

          <div className="details-actions form-actions">
            <button type="submit" className="primary-btn" disabled={busy} aria-busy={busy}>
              <span>{busy ? "Сохранение:" : "Сохранить"}</span>
              <span className="btn-glyph" aria-hidden="true">
                {busy ? (
                  <span className="btn-spinner" />
                ) : (
                  <svg viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3.5 8.4l3 3.1 6-6.5"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
            </button>
            <button
              type="button"
              className="ghost-btn details-dismiss"
              onClick={requestClose}
              disabled={busy}
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
