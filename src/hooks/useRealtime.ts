import { useEffect, useRef } from "react";
import {
  NOTIFY_URL,
  PUSHER_CHANNEL,
  PUSHER_CLUSTER,
  PUSHER_EVENT,
  PUSHER_KEY,
} from "../config";
import { debugLog } from "../realtime/debug";
import { CLIENT_ID, type ChangeKind } from "../realtime/notify";

const DEBOUNCE_MS = 150;
const POLL_WATCHED_MS = 8000;
const POLL_MOVIES_MS = 30000;

type Handlers = Record<ChangeKind, () => void | Promise<unknown>>;
/** Опрос возвращает true, если нашёл изменения. */
type Polls = Record<ChangeKind, () => Promise<boolean>>;

function isChangeKind(value: unknown): value is ChangeKind {
  return value === "watched" || value === "movies";
}

/**
 * Подписка на события Pusher. По событию вызывается соответствующий refetch:
 * источником правды остаётся Mokky, Pusher только сообщает об изменениях.
 */
export function useRealtime(handlers: Handlers, polls: Polls): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const pollsRef = useRef(polls);
  pollsRef.current = polls;

  // Запасной канал: уведомления с телефона могут не доходить до Worker
  // (сеть, провайдер), поэтому данные ещё и периодически сверяются с Mokky.
  useEffect(() => {
    const run = async (kind: ChangeKind) => {
      if (document.visibilityState !== "visible") {
        return;
      }
      if (await pollsRef.current[kind]()) {
        debugLog(`опрос «${kind}»: найдены изменения`);
      }
    };

    const timers = [
      window.setInterval(() => void run("watched"), POLL_WATCHED_MS),
      window.setInterval(() => void run("movies"), POLL_MOVIES_MS),
    ];
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void run("watched");
        void run("movies");
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      timers.forEach((timer) => window.clearInterval(timer));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    debugLog(
      `старт: вкладка ${CLIENT_ID.slice(0, 6)}, origin ${window.location.origin}, notify ${NOTIFY_URL ? "задан" : "НЕ задан"}`,
    );

    void import("pusher-js").then(({ default: Pusher }) => {
      if (disposed) {
        return;
      }

      const timers = new Map<ChangeKind, number>();
      const schedule = (kind: ChangeKind, reason: string) => {
        window.clearTimeout(timers.get(kind));
        timers.set(
          kind,
          window.setTimeout(() => {
            debugLog(`refetch «${kind}» (${reason})`);
            void Promise.resolve(handlersRef.current[kind]()).then(
              () => debugLog(`refetch «${kind}» готов`),
              (error) => debugLog(`refetch «${kind}» ошибка: ${String(error)}`),
            );
          }, DEBOUNCE_MS),
        );
      };

      const pusher = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
      const channel = pusher.subscribe(PUSHER_CHANNEL);

      pusher.connection.bind(
        "state_change",
        (states: { previous: string; current: string }) =>
          debugLog(`pusher: ${states.previous} -> ${states.current}`),
      );
      pusher.connection.bind("error", (error: unknown) =>
        debugLog(`pusher: ошибка соединения ${JSON.stringify(error)}`),
      );
      channel.bind("pusher:subscription_succeeded", () =>
        debugLog(`pusher: подписка на «${PUSHER_CHANNEL}» активна`),
      );
      channel.bind("pusher:subscription_error", (error: unknown) =>
        debugLog(`pusher: ошибка подписки ${JSON.stringify(error)}`),
      );

      channel.bind(PUSHER_EVENT, (data: unknown) => {
        const payload = data as { kind?: unknown; clientId?: unknown } | null;
        const from =
          typeof payload?.clientId === "string" ? payload.clientId.slice(0, 6) : "?";
        if (!payload || payload.clientId === CLIENT_ID || !isChangeKind(payload.kind)) {
          debugLog(`событие от ${from}: пропущено (своё или неверное)`);
          return;
        }
        debugLog(`событие «${payload.kind}» от ${from}`);
        schedule(payload.kind, "событие");
      });

      // После разрыва связи события могли быть пропущены: синхронизируемся целиком.
      let wasConnected = false;
      pusher.connection.bind("connected", () => {
        if (wasConnected) {
          schedule("watched", "переподключение");
          schedule("movies", "переподключение");
        }
        wasConnected = true;
      });

      // Только для отладки: фиксируем смену видимости вкладки.
      const onVisibility = () => debugLog(`вкладка: ${document.visibilityState}`);
      document.addEventListener("visibilitychange", onVisibility);

      cleanup = () => {
        document.removeEventListener("visibilitychange", onVisibility);
        timers.forEach((timer) => window.clearTimeout(timer));
        channel.unbind_all();
        pusher.unsubscribe(PUSHER_CHANNEL);
        pusher.disconnect();
      };
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);
}
