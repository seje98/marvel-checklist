import type { Movie, MovieTag, MovieType } from "../types/movie";

export const TYPE_LABELS: Record<MovieType, string> = {
  movie: "Фильм",
  series: "Сериал",
  special: "Спецвыпуск",
  "one-shot": "One-Shot",
  animation: "Анимация",
  legacy: "Legacy",
};

export interface BadgeInfo {
  key: MovieTag | "future";
  label: string;
  tone: "required" | "recommended" | "optional" | "multiverse" | "legacy" | "future";
}

const TAG_BADGES: Record<MovieTag, BadgeInfo> = {
  required: { key: "required", label: "Обязательно", tone: "required" },
  recommended: { key: "recommended", label: "Желательно", tone: "recommended" },
  optional: { key: "optional", label: "Необязательно", tone: "optional" },
  multiverse: { key: "multiverse", label: "Мультивселенная", tone: "multiverse" },
  tv: { key: "tv", label: "TV / Legacy", tone: "legacy" },
  legacy: { key: "legacy", label: "TV / Legacy", tone: "legacy" },
  future: { key: "future", label: "Будущее", tone: "future" },
};

export function getBadges(movie: Movie): BadgeInfo[] {
  const badges: BadgeInfo[] = [];
  const seen = new Set<string>();

  if (movie.future) {
    badges.push(TAG_BADGES.future);
    seen.add("future");
  }

  for (const tag of movie.tags) {
    if (tag === "tv" || tag === "legacy") {
      if (!seen.has("legacy")) {
        badges.push(TAG_BADGES.legacy);
        seen.add("legacy");
      }
      continue;
    }
    if (!seen.has(tag)) {
      badges.push(TAG_BADGES[tag]);
      seen.add(tag);
    }
  }

  return badges;
}

export function formatOrder(order: number): string {
  return String(order).padStart(3, "0");
}

export function formatYearLine(movie: Movie): string {
  const parts: string[] = [];
  if (movie.timeline) {
    parts.push(movie.timeline);
  }
  if (movie.releaseDate) {
    parts.push(movie.releaseDate);
  } else if (movie.releaseYear && movie.timeline !== String(movie.releaseYear)) {
    parts.push(String(movie.releaseYear));
  }
  if (movie.season) {
    parts.push(movie.season);
  }
  return parts.join(" · ");
}
