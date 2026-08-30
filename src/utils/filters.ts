import type {
  CanonFilter,
  ImportanceFilter,
  Movie,
  TypeFilter,
  WatchStatusFilter,
} from "../types/movie";

export function matchesSearch(movie: Movie, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const haystack = [
    movie.title,
    movie.originalTitle ?? "",
    movie.id,
    String(movie.order).padStart(3, "0"),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

export function matchesStatus(
  movie: Movie,
  status: WatchStatusFilter,
  watchedIds: ReadonlySet<string>,
): boolean {
  if (status === "all") {
    return true;
  }
  const watched = watchedIds.has(movie.id);
  return status === "watched" ? watched : !watched;
}

export function matchesImportance(
  movie: Movie,
  importance: ImportanceFilter,
): boolean {
  if (importance === "all") {
    return true;
  }
  return movie.tags.includes(importance);
}

export function matchesCanon(movie: Movie, canon: CanonFilter): boolean {
  if (canon === "all") {
    return true;
  }
  if (canon === "multiverse") {
    return movie.tags.includes("multiverse");
  }
  return (
    movie.type === "legacy" ||
    movie.tags.includes("legacy") ||
    movie.tags.includes("tv")
  );
}

export function matchesType(movie: Movie, type: TypeFilter): boolean {
  if (type === "all") {
    return true;
  }
  if (type === "legacy") {
    return movie.type === "legacy" || movie.tags.includes("legacy");
  }
  return movie.type === type;
}

export function hasActiveFilters(
  status: WatchStatusFilter,
  importance: ImportanceFilter,
  canon: CanonFilter,
  type: TypeFilter,
  query: string,
): boolean {
  return (
    status !== "all" ||
    importance !== "all" ||
    canon !== "all" ||
    type !== "all" ||
    query.trim().length > 0
  );
}
