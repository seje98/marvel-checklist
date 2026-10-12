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

/** Запрос дольше этого времени считается зависшим и отправляется заново. */
const ATTEMPT_TIMEOUT_MS = 4000;
const MAX_ATTEMPTS = 4;
const RETRY_DELAY_MS = 300;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function readPublishTime(response: Response): Promise<string> {
  try {
    const data = (await response.clone().json()) as { publishMs?: unknown };
    return typeof data.publishMs === "number" ? `, Worker->Pusher ${data.publishMs} мс` : "";
  } catch {
    return "";
  }
}

/**
 * Запрос к Worker иногда зависает на десятки секунд (на телефоне), поэтому
 * каждая попытка ограничена по времени и повторяется с новым соединением.
 * Тело отправляется как text/plain: это «простой» запрос без предварительного
 * CORS-запроса; Worker разбирает тело как JSON независимо от типа.
 * Повторные уведомления безвредны: клиенты объединяют их в один refetch.
 */
async function send(body: string, kind: ChangeKind): Promise<void> {
  if (!NOTIFY_URL) {
    return;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
    const startedAt = performance.now();
    const elapsed = () => Math.round(performance.now() - startedAt);

    try {
      const response = await fetch(NOTIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body,
        signal: controller.signal,
      });
      debugLog(
        `notify «${kind}» #${attempt}: HTTP ${response.status} за ${elapsed()} мс${await readPublishTime(response)}`,
      );
      if (response.ok) {
        return;
      }
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError";
      debugLog(
        `notify «${kind}» #${attempt}: ${aborted ? `завис, прервано через ${elapsed()} мс` : `ОШИБКА ${error instanceof Error ? error.message : String(error)}`}`,
      );
    } finally {
      window.clearTimeout(timer);
    }

    if (attempt < MAX_ATTEMPTS) {
      await wait(RETRY_DELAY_MS);
    }
  }

  debugLog(`notify «${kind}»: не удалось отправить за ${MAX_ATTEMPTS} попытки`);
}

/**
 * Сообщает остальным клиентам, что данные в Mokky изменились. Запись уже
 * сохранена, поэтому ошибки уведомления не показываются пользователю.
 */
export function notifyChanged(kind: ChangeKind): void {
  if (!NOTIFY_URL) {
    debugLog(`notify: «${kind}» не отправлен, VITE_NOTIFY_URL не задан`);
    return;
  }

  const body = JSON.stringify({ kind, clientId: CLIENT_ID });
  debugLog(
    `notify: отправляю «${kind}» (вкладка ${CLIENT_ID.slice(0, 6)}, ${document.visibilityState})`,
  );

  // Если страницу уже сворачивают, обычный запрос может не дойти.
  if (document.visibilityState === "hidden" && typeof navigator.sendBeacon === "function") {
    const queued = navigator.sendBeacon(NOTIFY_URL, new Blob([body], { type: "text/plain" }));
    debugLog(`notify: sendBeacon ${queued ? "принят" : "отклонён"}`);
    if (queued) {
      return;
    }
  }

  void wait(0).then(() => send(body, kind));
}
