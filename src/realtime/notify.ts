import { NOTIFY_URL } from "../config";

export type ChangeKind = "watched" | "movies";

function createClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Идентификатор этой вкладки: свои же события игнорируются. */
export const CLIENT_ID = createClientId();

/**
 * Сообщает остальным клиентам, что данные в Mokky изменились. Запись уже
 * сохранена, поэтому ошибки уведомления молча игнорируются.
 */
export function notifyChanged(kind: ChangeKind): void {
  if (!NOTIFY_URL) {
    return;
  }

  void fetch(NOTIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, clientId: CLIENT_ID }),
    keepalive: true,
  }).catch(() => undefined);
}
