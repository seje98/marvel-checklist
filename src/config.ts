export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "https://ebfc7a8ba624cb38.mokky.dev";
export const API_URL = `${API_BASE_URL}/watched`;
export const MOVIES_URL = `${API_BASE_URL}/movies`;
export const API_TIMEOUT_MS = 8000;

// Pusher Channels: ключ и кластер публичные. Секрет хранится только в Worker.
export const PUSHER_KEY = "f987127fca2394d2009a";
export const PUSHER_CLUSTER = "eu";
export const PUSHER_CHANNEL = "marvel-watchlist";
export const PUSHER_EVENT = "changed";

// Адрес Cloudflare Worker (например, https://marvel-watchlist-notify.<аккаунт>.workers.dev/notify).
// Задаётся переменной VITE_NOTIFY_URL; без неё уведомления другим клиентам не отправляются.
export const NOTIFY_URL: string = import.meta.env.VITE_NOTIFY_URL ?? "";

export const STORAGE_KEYS = {
  watched: "marvel-watchlist:watched",
  queue: "marvel-watchlist:queue",
  filters: "marvel-watchlist:filters",
  collapsed: "marvel-watchlist:collapsed",
  movies: "marvel-watchlist:movies",
} as const;
