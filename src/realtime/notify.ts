import { NOTIFY_URL } from "../config";
import { debugLog } from "./debug";

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
    debugLog(`notify: «${kind}» не отправлен, VITE_NOTIFY_URL не задан`);
    return;
  }

  debugLog(
    `notify: отправляю «${kind}» (вкладка ${CLIENT_ID.slice(0, 6)}, ${document.visibilityState})`,
  );
  const startedAt = performance.now();
  const elapsed = () => Math.round(performance.now() - startedAt);

  void fetch(NOTIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, clientId: CLIENT_ID }),
    keepalive: true,
  }).then(
    (response) => debugLog(`notify: HTTP ${response.status} за ${elapsed()} мс`),
    (error) =>
      debugLog(
        `notify: ОШИБКА ${error instanceof Error ? error.message : String(error)} за ${elapsed()} мс`,
      ),
  );
}
