// Временная отладка realtime: панель с журналом событий для телефона,
// где нет консоли. Включается адресом с ?debug (запоминается на сессию).

const STORAGE_KEY = "marvel-debug";
const MAX_LINES = 80;

function detectEnabled(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("debug")) {
      window.sessionStorage.setItem(STORAGE_KEY, params.get("debug") === "0" ? "" : "1");
    }
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export const DEBUG_ENABLED = typeof window !== "undefined" && detectEnabled();

type Listener = () => void;

let lines: string[] = [];
const listeners = new Set<Listener>();

function timestamp(): string {
  const now = new Date();
  const pad = (value: number, size = 2) => String(value).padStart(size, "0");
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
}

export function debugLog(message: string): void {
  if (!DEBUG_ENABLED) {
    return;
  }
  lines = [...lines.slice(-(MAX_LINES - 1)), `${timestamp()} ${message}`];
  listeners.forEach((listener) => listener());
}

export function clearDebugLog(): void {
  lines = [];
  listeners.forEach((listener) => listener());
}

export function subscribeDebugLog(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDebugLines(): string[] {
  return lines;
}
