export type Importance = "required" | "recommended" | "optional";

export type MovieType =
  | "movie"
  | "series"
  | "special"
  | "one-shot"
  | "animation"
  | "legacy";

export type MovieTag =
  | "required"
  | "recommended"
  | "optional"
  | "multiverse"
  | "tv"
  | "legacy"
  | "future";

export interface Movie {
  id: string;
  order: number;
  title: string;
  originalTitle?: string;
  timeline?: string;
  releaseYear?: number;
  releaseDate?: string;
  type: MovieType;
  season?: string;
  episodes?: number;
  studio?: string;
  universe?: string;
  tags: MovieTag[];
  section: number;
  sectionTitle: string;
  future?: boolean;
  notes?: string;
  warning?: string;
}

export interface WatchedRecord {
  id: number;
  filmId: string;
  episodes?: number;
}

export interface WatchedEntry {
  recordId: number | null;
  episodes?: number;
}

export type WatchStatusFilter = "all" | "watched" | "unwatched";
export type ImportanceFilter = "all" | Importance;
export type CanonFilter = "all" | "multiverse" | "legacy";
export type TypeFilter = "all" | MovieType;

export interface WatchlistFilters {
  status: WatchStatusFilter;
  importance: ImportanceFilter;
  canon: CanonFilter;
  type: TypeFilter;
}

export type SyncStatus = "synced" | "syncing" | "offline";

export type PendingAction = "watch" | "unwatch";

export interface PendingChange {
  filmId: string;
  action: PendingAction;
  episodes?: number;
}

export interface ToastAction {
  label: string;
  kind: "undo" | "retry";
  filmId?: string;
  episodes?: number;
}

export interface ToastMessage {
  id: number;
  type: "success" | "error" | "info";
  text: string;
  action?: ToastAction;
}
