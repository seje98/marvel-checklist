import { useEffect, useRef } from "react";
import {
  PUSHER_CHANNEL,
  PUSHER_CLUSTER,
  PUSHER_EVENT,
  PUSHER_KEY,
} from "../config";
import { CLIENT_ID, type ChangeKind } from "../realtime/notify";

const DEBOUNCE_MS = 150;
const POLL_WATCHED_MS = 3000;
const POLL_MOVIES_MS = 10000;

type Handlers = Record<ChangeKind, () => void | Promise<unknown>>;
type Polls = Record<ChangeKind, () => Promise<unknown>>;

function isChangeKind(value: unknown): value is ChangeKind {
  return value === "watched" || value === "movies";
}

/**
 * Обновление данных от других устройств.
 *
 * Основной канал — события Pusher: по событию вызывается соответствующий
 * refetch, источником правды остаётся Mokky. Запасной канал — периодический
 * тихий опрос Mokky: уведомление об изменении отправляется через Worker, а он
 * не открывается из некоторых мобильных сетей, и тогда события не приходят.
 */
export function useRealtime(handlers: Handlers, polls: Polls): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const pollsRef = useRef(polls);
  pollsRef.current = polls;

  useEffect(() => {
    const run = (kind: ChangeKind) => {
      if (document.visibilityState === "visible") {
        void pollsRef.current[kind]();
      }
    };

    const timers = [
      window.setInterval(() => run("watched"), POLL_WATCHED_MS),
      window.setInterval(() => run("movies"), POLL_MOVIES_MS),
    ];
    const onVisible = () => {
      run("watched");
      run("movies");
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

    void import("pusher-js").then(({ default: Pusher }) => {
      if (disposed) {
        return;
      }

      const timers = new Map<ChangeKind, number>();
      const schedule = (kind: ChangeKind) => {
        window.clearTimeout(timers.get(kind));
        timers.set(
          kind,
          window.setTimeout(() => void handlersRef.current[kind](), DEBOUNCE_MS),
        );
      };

      const pusher = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
      const channel = pusher.subscribe(PUSHER_CHANNEL);

      channel.bind(PUSHER_EVENT, (data: unknown) => {
        const payload = data as { kind?: unknown; clientId?: unknown } | null;
        if (!payload || payload.clientId === CLIENT_ID || !isChangeKind(payload.kind)) {
          return;
        }
        schedule(payload.kind);
      });

      // После разрыва связи события могли быть пропущены: синхронизируемся целиком.
      let wasConnected = false;
      pusher.connection.bind("connected", () => {
        if (wasConnected) {
          schedule("watched");
          schedule("movies");
        }
        wasConnected = true;
      });

      cleanup = () => {
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
