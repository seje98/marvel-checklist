import { API_URL } from "../config";
import type { WatchedRecord } from "../types/movie";
import { ApiError, isRecord, request } from "./http";

function isRawWatchedRecord(value: unknown): value is WatchedRecord {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    Number.isFinite(value.id) &&
    typeof value.filmId === "string" &&
    value.filmId.length > 0
  );
}

function normalizeRecord(record: WatchedRecord): WatchedRecord {
  const { episodes } = record;
  const valid =
    typeof episodes === "number" && Number.isInteger(episodes) && episodes >= 0;
  return {
    id: record.id,
    filmId: record.filmId,
    ...(valid ? { episodes } : {}),
  };
}

export function isWatchedRecord(value: unknown): value is WatchedRecord {
  return isRawWatchedRecord(value);
}

export async function getWatchedFilms(): Promise<WatchedRecord[]> {
  const data = await request<unknown>(API_URL);

  if (!Array.isArray(data)) {
    throw new ApiError("invalid", "Сервер вернул некорректный список просмотров");
  }

  return data.filter(isRawWatchedRecord).map(normalizeRecord);
}

export async function findWatchedByFilmId(
  filmId: string,
): Promise<WatchedRecord[]> {
  const url = `${API_URL}?filmId=${encodeURIComponent(filmId)}`;
  const data = await request<unknown>(url);

  if (!Array.isArray(data)) {
    throw new ApiError("invalid", "Сервер вернул некорректный ответ");
  }

  return data.filter(isRawWatchedRecord).map(normalizeRecord);
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

/**
 * Создаёт или обновляет запись о просмотре. Для сериалов `episodes` —
 * количество просмотренных серий; для фильмов параметр не передаётся.
 */
export async function markFilmAsWatched(
  filmId: string,
  episodes?: number,
): Promise<WatchedRecord> {
  const existing = await findWatchedByFilmId(filmId);
  if (existing.length > 0) {
    const record = existing[0];
    if (episodes === undefined || record.episodes === episodes) {
      return record;
    }

    const updated = await request<unknown>(`${API_URL}/${record.id}`, {
      method: "PATCH",
      body: JSON.stringify({ episodes }),
    });
    if (!isRawWatchedRecord(updated)) {
      return { ...record, episodes };
    }
    return normalizeRecord(updated);
  }

  const created = await request<unknown>(API_URL, {
    method: "POST",
    body: JSON.stringify(episodes === undefined ? { filmId } : { filmId, episodes }),
  });

  if (!isRawWatchedRecord(created)) {
    throw new ApiError("invalid", "Сервер вернул некорректную запись");
  }

  return normalizeRecord(created);
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
