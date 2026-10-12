import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

export interface DragState {
  id: string;
  /** Смещение перетаскиваемой строки от исходного места, px. */
  offset: number;
  /** Индекс, на который встанет строка (в итоговом списке). */
  target: number;
  /** Смещения остальных строк: они расступаются, освобождая место. */
  shifts: Record<string, number>;
  /** Строка «доезжает» до своего места после отпускания. */
  settling: boolean;
}

interface Layout {
  ids: string[];
  /** Верх строк в координатах страницы (без учёта transform). */
  tops: number[];
  heights: number[];
  gap: number;
}

interface Session {
  id: string;
  index: number;
  pointerId: number;
  startY: number;
  startScroll: number;
  lastY: number;
  timer: number;
  layout: Layout;
}

interface Options {
  disabled: boolean;
  /** `position` — новая позиция в списке, начиная с 1. */
  onDrop: (id: string, position: number) => void;
}

const EDGE_PX = 72;
const SCROLL_STEP_PX = 14;
const SETTLE_MS = 180;

function measure(list: HTMLElement): Layout {
  const rows = [...list.querySelectorAll<HTMLElement>("[data-row-id]")];
  const gap = Number.parseFloat(getComputedStyle(list).rowGap) || 0;
  const scroll = window.scrollY;
  return {
    ids: rows.map((row) => row.dataset.rowId ?? ""),
    tops: rows.map((row) => row.getBoundingClientRect().top + scroll),
    heights: rows.map((row) => row.getBoundingClientRect().height),
    gap,
  };
}

/** Куда встанет строка и как сдвинутся соседи при заданном смещении. */
function resolve(layout: Layout, index: number, offset: number) {
  const { ids, tops, heights, gap } = layout;
  const center = tops[index] + heights[index] / 2 + offset;

  let target = 0;
  for (let k = 0; k < ids.length; k += 1) {
    if (k !== index && tops[k] + heights[k] / 2 < center) {
      target += 1;
    }
  }

  const step = heights[index] + gap;
  const shifts: Record<string, number> = {};
  let slot = 0;
  if (target > index) {
    for (let k = index + 1; k <= target; k += 1) {
      shifts[ids[k]] = -step;
      slot += heights[k] + gap;
    }
  } else if (target < index) {
    for (let k = target; k < index; k += 1) {
      shifts[ids[k]] = step;
      slot -= heights[k] + gap;
    }
  }

  return { target, shifts, slot };
}

/**
 * Перетаскивание строк за ручку на pointer events: работает мышью и пальцем.
 * Строки должны иметь атрибут `data-row-id`. Соседние строки расступаются,
 * а отпущенная «доезжает» до освободившегося места.
 */
export function useRowDrag({ disabled, onDrop }: Options) {
  const listRef = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const settlingRef = useRef(false);
  const settleTimerRef = useRef(0);
  const optionsRef = useRef({ disabled, onDrop });
  optionsRef.current = { disabled, onDrop };

  const update = useCallback(() => {
    const session = sessionRef.current;
    if (!session) {
      return;
    }
    const offset = session.lastY - session.startY + (window.scrollY - session.startScroll);
    const { target, shifts } = resolve(session.layout, session.index, offset);
    setDrag({ id: session.id, offset, target, shifts, settling: false });
  }, []);

  const finish = useCallback((commit: boolean) => {
    const session = sessionRef.current;
    if (!session) {
      return;
    }
    sessionRef.current = null;
    window.clearInterval(session.timer);

    const offset = session.lastY - session.startY + (window.scrollY - session.startScroll);
    const resolved = resolve(session.layout, session.index, offset);
    const target = commit ? resolved.target : session.index;
    const final = commit
      ? resolved
      : { target: session.index, shifts: {}, slot: 0 };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const complete = () => {
      settlingRef.current = false;
      setDrag(null);
      if (target !== session.index) {
        optionsRef.current.onDrop(session.id, target + 1);
      }
    };

    if (reduceMotion) {
      complete();
      return;
    }

    settlingRef.current = true;
    setDrag({
      id: session.id,
      offset: final.slot,
      target: final.target,
      shifts: final.shifts,
      settling: true,
    });
    settleTimerRef.current = window.setTimeout(complete, SETTLE_MS);
  }, []);

  useEffect(() => {
    if (!drag || drag.settling) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        finish(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drag, finish]);

  useEffect(
    () => () => {
      window.clearTimeout(settleTimerRef.current);
      const session = sessionRef.current;
      if (session) {
        window.clearInterval(session.timer);
      }
    },
    [],
  );

  const getHandleProps = (id: string) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      const list = listRef.current;
      if (
        !list ||
        optionsRef.current.disabled ||
        sessionRef.current ||
        settlingRef.current ||
        event.button !== 0
      ) {
        return;
      }
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Захват недоступен: перетаскивание продолжится через события ручки.
      }

      const layout = measure(list);
      const index = layout.ids.indexOf(id);
      if (index === -1) {
        return;
      }

      sessionRef.current = {
        id,
        index,
        pointerId: event.pointerId,
        startY: event.clientY,
        startScroll: window.scrollY,
        lastY: event.clientY,
        layout,
        // Прокрутка страницы у края экрана, пока строка удерживается.
        timer: window.setInterval(() => {
          const current = sessionRef.current;
          if (!current) {
            return;
          }
          if (current.lastY < EDGE_PX) {
            window.scrollBy({ top: -SCROLL_STEP_PX, behavior: "instant" });
          } else if (current.lastY > window.innerHeight - EDGE_PX) {
            window.scrollBy({ top: SCROLL_STEP_PX, behavior: "instant" });
          } else {
            return;
          }
          update();
        }, 16),
      };
      update();
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const session = sessionRef.current;
      if (!session || session.pointerId !== event.pointerId) {
        return;
      }
      session.lastY = event.clientY;
      update();
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      if (sessionRef.current?.pointerId === event.pointerId) {
        finish(true);
      }
    },
    onPointerCancel: (event: PointerEvent<HTMLElement>) => {
      if (sessionRef.current?.pointerId === event.pointerId) {
        finish(false);
      }
    },
  });

  return { listRef, drag, getHandleProps };
}
