import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

type ToastKind = "success" | "error";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Lightweight toast feedback (guidelines §39): success/error, auto-dismiss,
 * dismissal buttons, live region for screen readers. Use sparingly — routine
 * saves should use inline "Saved" states instead of toasts.
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind) => (message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({ success: push("success"), error: push("error") }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* aria-live region announces toasts without stealing focus */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
            className={`flex items-start gap-2 p-3 rounded-lg border shadow-md text-xs ${
              toast.kind === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-red-50 border-red-200 text-red-900"
            }`}
          >
            {toast.kind === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" aria-hidden="true" />
            )}
            <span className="flex-1 leading-relaxed">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="p-0.5 opacity-60 hover:opacity-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-400 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
