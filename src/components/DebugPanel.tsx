import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  clearDebugLog,
  DEBUG_ENABLED,
  getDebugLines,
  subscribeDebugLog,
} from "../realtime/debug";

export function DebugPanel() {
  const lines = useSyncExternalStore(subscribeDebugLog, getDebugLines);
  const bodyRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const body = bodyRef.current;
    if (body) {
      body.scrollTop = body.scrollHeight;
    }
  }, [lines]);

  if (!DEBUG_ENABLED) {
    return null;
  }

  return (
    <aside className="debug-panel" aria-label="Журнал отладки">
      <div className="debug-bar">
        <span>debug realtime</span>
        <button type="button" onClick={clearDebugLog}>
          очистить
        </button>
      </div>
      <pre ref={bodyRef} className="debug-body">
        {lines.join("\n")}
      </pre>
    </aside>
  );
}
