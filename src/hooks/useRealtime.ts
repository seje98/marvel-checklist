import { useEffect, useRef } from "react";
import { connectRealtime, type ChangeKind } from "../realtime/channel";

const DEBOUNCE_MS = 150;
const POLL_WATCHED_MS = 3000;
const POLL_MOVIES_MS = 10000;

type Handlers = Record<ChangeKind, () => void | Promise<unknown>>;
type Polls = Record<ChangeKind, () => Promise<unknown>>;

/**
 * Обновление данных от других устройств.
 *
 * Основной канал — события Supabase Realtime: по событию вызывается
 * соответствующий refetch, источником правды остаётся Mokky. Запасной канал —
 * периодический тихий опрос Mokky: он подхватит изменения, если соединение
 * с Realtime оборвалось или уведомление потерялось.
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
