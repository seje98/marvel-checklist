import { STORAGE_KEYS } from "../config";
import type {
  CanonFilter,
  ImportanceFilter,
  PendingChange,
  TypeFilter,
  WatchlistFilters,
} from "../types/movie";

export type WatchedCache = Record<string, number | null>;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private mode — ignore.
  }
}

export function loadWatchedCache(): WatchedCache {
  const data = readJson<WatchedCache>(STORAGE_KEYS.watched, {});
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }
  return data;
}

export function saveWatchedCache(cache: WatchedCache): void {
  writeJson(STORAGE_KEYS.watched, cache);
}

export function cacheFromMap(map: Map<string, number | null>): WatchedCache {
  return Object.fromEntries(map.entries());
}

export function mapFromCache(cache: WatchedCache): Map<string, number | null> {
  return new Map(Object.entries(cache));
}

export function loadQueue(): PendingChange[] {
  const data = readJson<PendingChange[]>(STORAGE_KEYS.queue, []);
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter(
    (item): item is PendingChange =>
      Boolean(item) &&
      typeof item.filmId === "string" &&
      (item.action === "watch" || item.action === "unwatch"),
  );
}

export function saveQueue(queue: PendingChange[]): void {
  writeJson(STORAGE_KEYS.queue, queue);
}

export const DEFAULT_FILTERS: WatchlistFilters = {
  status: "all",
  importance: "all",
  canon: "all",
  type: "all",
};

function parseImportance(
  value: unknown,
): { importance: ImportanceFilter; canon: CanonFilter } {
  if (value === "multiverse" || value === "legacy") {
    return { importance: "all", canon: value };
  }
  if (
    value === "required" ||
    value === "recommended" ||
    value === "optional" ||
    value === "all"
  ) {
    return { importance: value, canon: "all" };
  }
  return { importance: "all", canon: "all" };
}

function parseCanon(value: unknown, fallback: CanonFilter): CanonFilter {
  if (value === "multiverse" || value === "legacy" || value === "all") {
    return value;
  }
  return fallback;
}

function parseType(value: unknown): TypeFilter {
  if (
    value === "movie" ||
    value === "series" ||
    value === "one-shot" ||
    value === "special" ||
    value === "animation" ||
    value === "legacy"
  ) {
    return value;
  }
  return "all";
}

export function loadFilters(): WatchlistFilters {
  const data = readJson<Partial<WatchlistFilters> & { importance?: unknown }>(
    STORAGE_KEYS.filters,
    DEFAULT_FILTERS,
  );
  const migrated = parseImportance(data.importance);
  return {
    status:
      data.status === "watched" || data.status === "unwatched"
        ? data.status
        : "all",
    importance: migrated.importance,
    canon: parseCanon(data.canon, migrated.canon),
    type: parseType(data.type),
  };
}

export function saveFilters(filters: WatchlistFilters): void {
  writeJson(STORAGE_KEYS.filters, filters);
}

export function loadCollapsed(): number[] {
  const data = readJson<number[]>(STORAGE_KEYS.collapsed, []);
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter((value) => typeof value === "number");
}

export function saveCollapsed(sections: number[]): void {
  writeJson(STORAGE_KEYS.collapsed, sections);
}
