import { API_TIMEOUT_MS, API_URL } from "../config";
import type { WatchedRecord } from "../types/movie";

export class ApiError extends Error {
  readonly kind: "timeout" | "network" | "invalid" | "http";
  readonly status?: number;

  constructor(
    kind: ApiError["kind"],
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isWatchedRecord(value: unknown): value is WatchedRecord {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    Number.isFinite(value.id) &&
    typeof value.filmId === "string" &&
    value.filmId.length > 0
  );
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new ApiError(
        "http",
        `Сервер вернул ошибку ${response.status}`,
        response.status,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError("invalid", "Сервер вернул некорректный ответ");
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("timeout", "Превышено время ожидания сервера");
    }

    throw new ApiError("network", "Соединение с сервером отсутствует");
  } finally {
    window.clearTimeout(timer);
  }
}

export async function getWatchedFilms(): Promise<WatchedRecord[]> {
  const data = await request<unknown>(API_URL);

  if (!Array.isArray(data)) {
    throw new ApiError("invalid", "Сервер вернул некорректный список просмотров");
  }

  return data.filter(isWatchedRecord);
}

export async function findWatchedByFilmId(
  filmId: string,
): Promise<WatchedRecord[]> {
  const url = `${API_URL}?filmId=${encodeURIComponent(filmId)}`;
  const data = await request<unknown>(url);

  if (!Array.isArray(data)) {
    throw new ApiError("invalid", "Сервер вернул некорректный ответ");
  }

  return data.filter(isWatchedRecord);
}

async function deleteById(id: number): Promise<void> {
  try {
    await request<unknown>(`${API_URL}/${id}`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return;
    }
    throw error;
  }
}

export async function markFilmAsWatched(
  filmId: string,
): Promise<WatchedRecord> {
  const existing = await findWatchedByFilmId(filmId);
  if (existing.length > 0) {
    return existing[0];
  }

  const created = await request<unknown>(API_URL, {
    method: "POST",
    body: JSON.stringify({ filmId }),
  });

  if (!isWatchedRecord(created)) {
    throw new ApiError("invalid", "Сервер вернул некорректную запись");
  }

  return created;
}

export async function unmarkFilmAsWatched(
  filmId: string,
  recordId?: number,
): Promise<void> {
  if (typeof recordId === "number") {
    await deleteById(recordId);
    return;
  }

  const existing = await findWatchedByFilmId(filmId);
  if (existing.length === 0) {
    return;
  }

  await Promise.all(existing.map((record) => deleteById(record.id)));
}
