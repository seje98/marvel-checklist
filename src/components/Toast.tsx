import { useEffect, useRef, useState } from "react";
import type { ToastMessage } from "../types/movie";

const EXIT_MS = 180;

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
  onAction: (toast: ToastMessage) => void;
}

function getExitMs() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : EXIT_MS;
}

function ToastCard({
  toast,
  exiting,
  onDismiss,
  onAction,
}: {
  toast: ToastMessage;
  exiting: boolean;
  onDismiss: (id: number) => void;
  onAction: (toast: ToastMessage) => void;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setShown(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={`toast toast-${toast.type}${exiting ? " is-exiting" : ""}`}
      data-shown={shown ? "true" : undefined}
    >
      <p className="toast-text">{toast.text}</p>
      {toast.action ? (
        <button
          type="button"
          className="toast-action"
          onClick={() => onAction(toast)}
        >
          {toast.action.label}
        </button>
      ) : (
        <button
          type="button"
          className="toast-dismiss"
          onClick={() => onDismiss(toast.id)}
          aria-label="Закрыть уведомление"
        >
          Закрыть
        </button>
      )}
    </div>
  );
}

export function Toast({ toasts, onDismiss, onAction }: ToastProps) {
  const [exitingIds, setExitingIds] = useState<number[]>([]);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const timersRef = useRef(new Map<number, number>());

  const dismiss = (id: number) => {
    if (timersRef.current.has(id)) {
      return;
    }

    setExitingIds((current) => (current.includes(id) ? current : [...current, id]));

    const timeout = window.setTimeout(() => {
      timersRef.current.delete(id);
      setExitingIds((current) => current.filter((item) => item !== id));
      onDismissRef.current(id);
    }, getExitMs());
    timersRef.current.set(id, timeout);
  };

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          exiting={exitingIds.includes(toast.id)}
          onDismiss={dismiss}
          onAction={(item) => {
            onAction(item);
            dismiss(item.id);
          }}
        />
      ))}
    </div>
  );
}
