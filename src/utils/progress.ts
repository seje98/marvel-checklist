import type { Movie, WatchedEntry } from "../types/movie";

export function hasEpisodes(movie: Movie): movie is Movie & { episodes: number } {
  return typeof movie.episodes === "number" && movie.episodes > 0;
}

export interface EpisodeRange {
  first: number;
  last: number;
}

/**
 * Номера серий, которые входят в запись. Для частей сезона («S1 E08–E22»)
 * это 8–22, для остальных сериалов — с первой серии до последней.
 */
export function getEpisodeRange(movie: Movie & { episodes: number }): EpisodeRange {
  const match = movie.season?.match(/E(\d+)\s*[–-]\s*E(\d+)/);
  if (match) {
    const first = Number(match[1]);
    const last = Number(match[2]);
    if (last - first + 1 === movie.episodes) {
      return { first, last };
    }
  }
  return { first: 1, last: movie.episodes };
}

/**
 * Количество просмотренных серий. Запись без `episodes` (сделанная до появления
 * счётчика серий) считается полностью просмотренным сериалом.
 */
export function getWatchedEpisodes(
  movie: Movie,
  entry: WatchedEntry | undefined,
): number {
  if (!entry || !hasEpisodes(movie)) {
    return 0;
  }
  if (entry.episodes === undefined) {
    return movie.episodes;
  }
  return Math.min(entry.episodes, movie.episodes);
}

export function isFullyWatched(
  movie: Movie,
  entry: WatchedEntry | undefined,
): boolean {
  if (!entry) {
    return false;
  }
  if (!hasEpisodes(movie)) {
    return true;
  }
  return getWatchedEpisodes(movie, entry) >= movie.episodes;
}

export interface ProgressStats {
  watched: number;
  total: number;
  remaining: number;
  percent: number;
  complete: boolean;
}

export function isTrackable(movie: Movie): boolean {
  return movie.future !== true && !movie.tags.includes("future");
}

export function getProgress(
  movies: Movie[],
  watchedIds: ReadonlySet<string>,
): ProgressStats {
  const trackable = movies.filter(isTrackable);
  const watched = trackable.filter((movie) => watchedIds.has(movie.id)).length;
  const total = trackable.length;
  const percent = total === 0 ? 0 : Math.round((watched / total) * 100);

  return {
    watched,
    total,
    remaining: Math.max(total - watched, 0),
    percent,
    complete: total > 0 && watched === total,
  };
}

export interface SectionGroup {
  section: number;
  title: string;
  movies: Movie[];
}

export function groupBySection(movies: Movie[]): SectionGroup[] {
  const groups: SectionGroup[] = [];
  const indexBySection = new Map<number, number>();

  for (const movie of movies) {
    const existing = indexBySection.get(movie.section);
    if (existing === undefined) {
      indexBySection.set(movie.section, groups.length);
      groups.push({
        section: movie.section,
        title: movie.sectionTitle,
        movies: [movie],
      });
    } else {
      groups[existing].movies.push(movie);
    }
  }

  return groups;
}
