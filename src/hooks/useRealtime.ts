import { useEffect, useRef } from "react";
import {
  PUSHER_CHANNEL,
  PUSHER_CLUSTER,
  PUSHER_EVENT,
  PUSHER_KEY,
} from "../config";
import { CLIENT_ID, type ChangeKind } from "../realtime/notify";

const DEBOUNCE_MS = 150;

type Handlers = Record<ChangeKind, () => void>;

function isChangeKind(value: unknown): value is ChangeKind {
  return value === "watched" || value === "movies";
}

/**
 * Подписка на события Pusher. По событию вызывается соответствующий refetch:
 * источником правды остаётся Mokky, Pusher только сообщает об изменениях.
 */
export function useRealtime(handlers: Handlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

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
          window.setTimeout(() => handlersRef.current[kind](), DEBOUNCE_MS),
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
