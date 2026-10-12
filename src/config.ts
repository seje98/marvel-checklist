export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "https://ebfc7a8ba624cb38.mokky.dev";
export const API_URL = `${API_BASE_URL}/watched`;
export const MOVIES_URL = `${API_BASE_URL}/movies`;
export const API_TIMEOUT_MS = 8000;

// Supabase Realtime (Broadcast): мгновенные уведомления между устройствами.
// Публичный ключ (publishable) предназначен для браузера, секретов здесь нет.
export const SUPABASE_URL = "https://eycwbrbcchvedbgdlvkh.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_765fNHnLlzgIKVJ2gzl9Ww_jcJvq-oz";
export const REALTIME_CHANNEL = "marvel-watchlist";
export const REALTIME_EVENT = "changed";

export const STORAGE_KEYS = {
  watched: "marvel-watchlist:watched",
  queue: "marvel-watchlist:queue",
  filters: "marvel-watchlist:filters",
  collapsed: "marvel-watchlist:collapsed",
  movies: "marvel-watchlist:movies",
} as const;
