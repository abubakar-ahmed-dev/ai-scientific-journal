import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  MessageSquare,
  ListTodo,
  FolderKanban,
  LayoutDashboard,
  FileText,
  Map,
  Settings,
  CornerDownLeft,
} from "lucide-react";
import { fetchObservations, fetchProjects } from "../lib/api";
import type { Observation, Project } from "../lib/api";

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  section: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Command palette (guidelines §7/§45): Ctrl/Cmd+K, keyboard-first navigation.
 * Only real capabilities are listed — page navigation, quick actions, and
 * recently updated projects/observations loaded on open. No fake full-text
 * search: the input filters the item labels only.
 */
export const CommandPalette: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [recentObservations, setRecentObservations] = useState<Observation[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Load recent items each time the palette opens (cheap: limit 5 each).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.allSettled([
      fetchProjects({ limit: 5 }),
      fetchObservations({ limit: 5 }),
    ]).then(([projRes, obsRes]) => {
      if (cancelled) return;
      if (projRes.status === "fulfilled") setRecentProjects(projRes.value.data || []);
      if (obsRes.status === "fulfilled") setRecentObservations(obsRes.value.data || []);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const go = useCallback(
    (to: string) => {
      onClose();
      navigate(to);
    },
    [navigate, onClose]
  );

  const items = useMemo<CommandItem[]>(() => {
    const all: CommandItem[] = [
      { id: "nav-dashboard", label: "Dashboard", section: "Navigation", icon: LayoutDashboard, action: () => go("/dashboard") },
      { id: "nav-observations", label: "Observations", section: "Navigation", icon: FileText, action: () => go("/observations") },
      { id: "nav-map", label: "Research Map", section: "Navigation", icon: Map, action: () => go("/map") },
      { id: "nav-ask", label: "Ask Journal", section: "Navigation", icon: Search, action: () => go("/ask") },
      { id: "nav-tasks", label: "Tasks", section: "Navigation", icon: ListTodo, action: () => go("/tasks") },
      { id: "nav-projects", label: "Projects", section: "Navigation", icon: FolderKanban, action: () => go("/projects") },
      { id: "nav-chat", label: "AI Chat", section: "Navigation", icon: MessageSquare, action: () => go("/conversations") },
      { id: "nav-settings", label: "Settings", section: "Navigation", icon: Settings, action: () => go("/settings") },

      { id: "act-new-obs", label: "New Observation", hint: "Record research", section: "Quick Actions", icon: Plus, action: () => go("/observations/new") },
      { id: "act-ask", label: "Ask Journal", hint: "Search your knowledge", section: "Quick Actions", icon: Search, action: () => go("/ask") },
      { id: "act-chat", label: "Open AI Chat", hint: "Work with AI", section: "Quick Actions", icon: MessageSquare, action: () => go("/conversations") },
      { id: "act-add-task", label: "Create Task", hint: "Plan your work", section: "Quick Actions", icon: ListTodo, action: () => go("/tasks") },
    ];

    recentProjects.forEach((p) =>
      all.push({
        id: `proj-${p.id}`,
        label: p.title,
        hint: "Project",
        section: "Recent Projects",
        icon: FolderKanban,
        action: () => go(`/projects/${p.id}`),
      })
    );
    recentObservations.forEach((o) =>
      all.push({
        id: `obs-${o.id}`,
        label: o.title,
        hint: "Observation",
        section: "Recent Observations",
        icon: FileText,
        action: () => go(`/observations/${o.id}`),
      })
    );
    return all;
  }, [go, recentProjects, recentObservations]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.section.toLowerCase().includes(q)
    );
  }, [items, query]);

  // Reset state whenever the palette opens/closes.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      // Focus the input after mount.
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
    return () => {
      if (open) previouslyFocused.current?.focus();
    };
  }, [open]);

  // Keep the active item in view and clamp when the filter shrinks the list.
  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(Math.max(0, filtered.length - 1));
  }, [filtered.length, activeIndex]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) item.action();
      return;
    }
    if (e.key === "Tab") {
      // Tab keeps native focus inside the dialog's focusable elements;
      // wrap manually between input and list buttons.
      const elements = listRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!elements || elements.length === 0) return;
      const first = inputRef.current!;
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

  let lastSection = "";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-start justify-center pt-[12vh] p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden outline-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 border-b border-slate-100">
          <Search className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            data-no-focus-ring
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Jump to a page, action, or recent item…"
            aria-label="Search commands"
            className="w-full py-3.5 text-sm bg-transparent focus:outline-hidden placeholder:text-slate-400"
          />
          <kbd className="shrink-0 text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto p-2" role="listbox" aria-label="Commands">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-400">No matching commands.</p>
          ) : (
            filtered.map((item, idx) => {
              const showSection = item.section !== lastSection;
              lastSection = item.section;
              const Icon = item.icon;
              const active = idx === activeIndex;
              return (
                <React.Fragment key={item.id}>
                  {showSection && (
                    <p className="px-2.5 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {item.section}
                    </p>
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={item.action}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      active ? "bg-indigo-50 text-indigo-900" : "text-slate-700"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? "text-indigo-600" : "text-slate-400"}`} />
                    <span className="flex-1 text-left font-medium truncate">{item.label}</span>
                    {item.hint && (
                      <span className="shrink-0 text-[10px] text-slate-400">{item.hint}</span>
                    )}
                    {active && <CornerDownLeft className="w-3 h-3 shrink-0 text-indigo-400" />}
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
