import { MOVIES_URL } from "../config";
import {
  MOVIE_TAGS,
  MOVIE_TYPES,
  type Movie,
  type MovieTag,
  type MovieType,
} from "../types/movie";
import { ApiError, isRecord, request } from "./http";

/** Данные проекта без служебного `recordId`. */
export type MovieDraft = Omit<Movie, "recordId">;

const STRING_FIELDS = [
  "originalTitle",
  "timeline",
  "releaseDate",
  "season",
  "studio",
  "universe",
  "notes",
  "warning",
] as const;

const NUMBER_FIELDS = ["releaseYear", "episodes"] as const;

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Приводит запись Mokky к `Movie`; возвращает `null`, если запись непригодна. */
export function parseMovie(raw: unknown): Movie | null {
  if (!isRecord(raw)) {
    return null;
  }

  const { id, slug, order, title, type, tags, section, sectionTitle } = raw;

  // Правятся и удаляются только записи с числовым `id` Mokky. Записи без него
  // (например, импортированные в дашборде) читаются, но остаются только для чтения.
  const recordId = typeof id === "number" && Number.isFinite(id) ? id : undefined;
  const movieId =
    typeof slug === "string" && slug !== ""
      ? slug
      : typeof id === "string" && id !== ""
        ? id
        : null;

  if (
    movieId === null ||
    typeof order !== "number" ||
    !Number.isFinite(order) ||
    typeof title !== "string" ||
    title === "" ||
    typeof type !== "string" ||
    !(MOVIE_TYPES as readonly string[]).includes(type) ||
    !Array.isArray(tags) ||
    typeof section !== "number" ||
    !Number.isFinite(section) ||
    typeof sectionTitle !== "string"
  ) {
    return null;
  }

  const movie: Movie = {
    id: movieId,
    ...(recordId !== undefined ? { recordId } : {}),
    order,
    title,
    type: type as MovieType,
    tags: tags.filter((tag): tag is MovieTag =>
      (MOVIE_TAGS as readonly string[]).includes(tag as string),
    ),
    section,
    sectionTitle,
  };

  for (const key of STRING_FIELDS) {
    const value = optionalString(raw[key]);
    if (value !== undefined) {
      movie[key] = value;
    }
  }
  for (const key of NUMBER_FIELDS) {
    const value = optionalNumber(raw[key]);
    if (value !== undefined) {
      movie[key] = value;
    }
  }
  if (raw.future === true) {
    movie.future = true;
  }

  return movie;
}

function sortMovies(movies: Movie[]): Movie[] {
  return movies.slice().sort((a, b) => a.order - b.order);
}

/**
 * Тело запроса. Пустые необязательные поля отправляются как `null`, чтобы
 * PATCH действительно очищал значение в Mokky; при чтении `null` игнорируется.
 */
function toPayload(movie: MovieDraft): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    slug: movie.id,
    order: movie.order,
    title: movie.title,
    type: movie.type,
    tags: movie.tags,
    section: movie.section,
    sectionTitle: movie.sectionTitle,
    future: movie.future === true ? true : null,
  };
  for (const key of [...STRING_FIELDS, ...NUMBER_FIELDS]) {
    payload[key] = movie[key] ?? null;
  }
  return payload;
}

function requireMovie(value: unknown): Movie {
  const movie = parseMovie(value);
  if (!movie) {
    throw new ApiError("invalid", "Сервер вернул некорректную запись проекта");
  }
  return movie;
}

export async function getMovies(): Promise<Movie[]> {
  const data = await request<unknown>(MOVIES_URL);
  if (!Array.isArray(data)) {
    throw new ApiError("invalid", "Сервер вернул некорректный список проектов");
  }

  const seen = new Set<string>();
  const movies: Movie[] = [];
  for (const item of data) {
    const movie = parseMovie(item);
    if (movie && !seen.has(movie.id)) {
      seen.add(movie.id);
      movies.push(movie);
    }
  }
  if (data.length > 0 && movies.length === 0) {
    throw new ApiError(
      "invalid",
      "Записи в Mokky имеют неожиданный формат (нужны поля slug, title, type, tags, section, sectionTitle, order)",
    );
  }
  return sortMovies(movies);
}

export async function createMovie(draft: MovieDraft): Promise<Movie> {
  const created = await request<unknown>(MOVIES_URL, {
    method: "POST",
    body: JSON.stringify(toPayload(draft)),
  });
  return requireMovie(created);
}

export async function updateMovie(
  recordId: number,
  draft: MovieDraft,
): Promise<Movie> {
  const updated = await request<unknown>(`${MOVIES_URL}/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify(toPayload(draft)),
  });
  return requireMovie(updated);
}

export async function updateMovieOrder(
  recordId: number,
  order: number,
): Promise<void> {
  await request<unknown>(`${MOVIES_URL}/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify({ order }),
  });
}

export async function deleteMovie(recordId: number): Promise<void> {
  try {
    await request<unknown>(`${MOVIES_URL}/${recordId}`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return;
    }
    throw error;
  }
}
