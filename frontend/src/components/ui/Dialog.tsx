import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog (rendered as the heading). */
  title: string;
  children: React.ReactNode;
  /** Renders as the primary footer action when provided. */
  footer?: React.ReactNode;
}

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog (guidelines §44/§45): role="dialog" + aria-modal,
 * Escape closes, focus is trapped inside and restored to the previously
 * focused element on close. Rendered content stays plain children so the
 * same primitive backs confirm dialogs and any future modal.
 */
export const Dialog: React.FC<DialogProps> = ({ open, onClose, title, children, footer }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Move focus into the dialog.
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    (focusable && focusable.length > 0 ? focusable[0] : panelRef.current)?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === "Tab" && panelRef.current) {
        const elements = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (elements.length === 0) return;
        const first = elements[0];
        const last = elements[elements.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 outline-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-sm text-slate-600">{children}</div>

        {footer && <div className="pt-2 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
};
