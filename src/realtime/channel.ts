import type { RealtimeChannel } from "@supabase/realtime-js";
import {
  REALTIME_CHANNEL,
  REALTIME_EVENT,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "../config";

export type ChangeKind = "watched" | "movies";

function createClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Идентификатор этой вкладки: свои же события игнорируются. */
export const CLIENT_ID = createClientId();

function isChangeKind(value: unknown): value is ChangeKind {
  return value === "watched" || value === "movies";
}

let activeChannel: RealtimeChannel | null = null;
let subscribed = false;
// Уведомления, отправленные до подключения канала, уходят сразу после него.
let pending: ChangeKind[] = [];

function post(channel: RealtimeChannel, kind: ChangeKind): void {
  // Если WebSocket сейчас недоступен, библиотека отправляет сообщение через HTTP.
  void channel
    .send({
      type: "broadcast",
      event: REALTIME_EVENT,
      payload: { kind, clientId: CLIENT_ID },
    })
    .catch(() => undefined);
}

/**
 * Сообщает остальным устройствам, что данные в Mokky изменились. Запись уже
 * сохранена, поэтому ошибки молча игнорируются: остальные устройства всё
 * равно увидят изменения при очередном опросе.
 */
export function notifyChanged(kind: ChangeKind): void {
  if (activeChannel) {
    post(activeChannel, kind);
    return;
  }
  pending = [...pending.filter((item) => item !== kind), kind];
}

interface RealtimeHandlers {
  /** Другое устройство изменило данные. */
  onChange: (kind: ChangeKind) => void;
  /** Связь восстановилась: события могли быть пропущены. */
  onResync: () => void;
}

/** Подключается к каналу и возвращает функцию отключения. */
export function connectRealtime({ onChange, onResync }: RealtimeHandlers): () => void {
  let disposed = false;
  let cleanup: (() => void) | undefined;

  void import("@supabase/realtime-js").then(({ RealtimeClient }) => {
    if (disposed) {
      return;
    }

    const client = new RealtimeClient(`${SUPABASE_URL}/realtime/v1`, {
      params: { apikey: SUPABASE_PUBLISHABLE_KEY },
    });
    const channel = client.channel(REALTIME_CHANNEL, {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: REALTIME_EVENT }, ({ payload }) => {
      const data = payload as { kind?: unknown; clientId?: unknown } | null;
      if (!data || data.clientId === CLIENT_ID || !isChangeKind(data.kind)) {
        return;
      }
      onChange(data.kind);
    });

    let wasSubscribed = false;
    channel.subscribe((status) => {
      subscribed = status === "SUBSCRIBED";
      if (!subscribed) {
        return;
      }
      if (wasSubscribed) {
        onResync();
      }
      wasSubscribed = true;

      const queued = pending;
      pending = [];
      queued.forEach((kind) => post(channel, kind));
    });

    activeChannel = channel;
    cleanup = () => {
      if (activeChannel === channel) {
        activeChannel = null;
        subscribed = false;
      }
      void client.removeChannel(channel);
      client.disconnect();
    };
  });

  return () => {
    disposed = true;
    cleanup?.();
  };
}
