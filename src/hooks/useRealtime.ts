import { useEffect, useRef } from "react";
import { connectRealtime, type ChangeKind } from "../realtime/channel";

const DEBOUNCE_MS = 150;

type Handlers = Record<ChangeKind, () => void | Promise<unknown>>;

/**
 * Обновление данных от других устройств через Supabase Realtime: по событию
 * вызывается соответствующий refetch, источником правды остаётся Mokky.
 * После восстановления связи данные перечитываются целиком, потому что
 * события за время обрыва могли быть пропущены.
 */
export function useRealtime(handlers: Handlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const timers = new Map<ChangeKind, number>();
    const schedule = (kind: ChangeKind) => {
      window.clearTimeout(timers.get(kind));
      timers.set(
        kind,
        window.setTimeout(() => void handlersRef.current[kind](), DEBOUNCE_MS),
      );
    };

    const disconnect = connectRealtime({
      onChange: schedule,
      onResync: () => {
        schedule("watched");
        schedule("movies");
      },
    });

    return () => {
      disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);
}
