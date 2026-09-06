import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  FileText,
  Map,
  Search,
  ListTodo,
  FolderKanban,
  MessageSquare,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "../lib/firebase/authContext";
import { CommandPalette } from "./CommandPalette";

interface NavLinkItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  heading?: string;
  links: NavLinkItem[];
}

/**
 * Canonical grouped navigation (UX guidelines §3/§5). One model feeds both the
 * desktop sidebar and the mobile drawer so the two never drift.
 */
const NAV_SECTIONS: NavSection[] = [
  { heading: "Workspace", links: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    heading: "Research",
    links: [
      { to: "/observations", label: "Observations", icon: FileText },
      { to: "/map", label: "Research Map", icon: Map },
      { to: "/ask", label: "Ask Journal", icon: Search },
    ],
  },
  {
    heading: "Work",
    links: [
      { to: "/tasks", label: "Tasks", icon: ListTodo },
      { to: "/projects", label: "Projects", icon: FolderKanban },
    ],
  },
  { heading: "AI", links: [{ to: "/conversations", label: "AI Chat", icon: MessageSquare }] },
];

const SETTINGS_LINK: NavLinkItem = { to: "/settings", label: "Settings", icon: Settings };

/** Sidebar collapse preference (guidelines §5.3). Persisted locally. */
const SIDEBAR_COLLAPSED_KEY = "asj.sidebar.collapsed";

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, signOut } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [prevPath, setPrevPath] = useState(location.pathname);
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const hamburgerBtnRef = React.useRef<HTMLButtonElement>(null);

  // Global Ctrl/Cmd+K opens the command palette (guidelines §6/§45).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close mobile drawer on route change without cascading effect
  if (location.pathname !== prevPath) {
    setPrevPath(location.pathname);
    setMobileMenuOpen(false);
  }

  // Focus trap and Escape key handling for mobile drawer (F9)
  useEffect(() => {
    if (!mobileMenuOpen) return;

    // Focus first focusable element inside drawer
    const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && focusable.length > 0) {
      focusable[0]?.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
        hamburgerBtnRef.current?.focus();
        return;
      }

      if (e.key === "Tab" && drawerRef.current) {
        const focusableElements = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const isActive = (to: string) =>
    location.pathname === to || (to !== "/dashboard" && location.pathname.startsWith(to));

  const toggleSidebar = () => {
    setSidebarCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // Storage unavailable (private mode) — preference just won't persist.
      }
      return next;
    });
  };

  const userInitial = (currentUser?.displayName?.[0] || currentUser?.email?.[0] || "U").toUpperCase();

  const renderNavItem = (link: NavLinkItem, onNavigate?: () => void) => {
    const Icon = link.icon;
    const active = isActive(link.to);
    const collapsed = sidebarCollapsed;
    return (
      <Link
        key={link.to}
        to={link.to}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        title={collapsed ? link.label : undefined}
        aria-label={collapsed ? link.label : undefined}
        className={`relative flex items-center rounded-md text-sm transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          collapsed ? "justify-center mx-1" : "gap-3.5"
        } ${
          active
            ? "bg-indigo-50 font-semibold text-indigo-700"
            : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        {/* Non-color active indicator (guidelines §5.2): left accent bar + weight + background */}
        {active && !collapsed && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-indigo-600"
          />
        )}
        {/* Collapsed active state: filled dot below the icon (not color-only, §5.2) */}
        {active && collapsed && (
          <span
            aria-hidden="true"
            className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-indigo-600"
          />
        )}
        <Icon className={`h-4 w-4 shrink-0 ${collapsed ? "my-2.5" : "ml-2.5"} ${
          active ? "text-indigo-600" : "text-slate-400"
        }`} />
        {!collapsed && <span className="py-2 pr-2">{link.label}</span>}
      </Link>
    );
  };

  const sidebarContent = (
    <nav aria-label="Main Navigation" className="flex h-full flex-col gap-5 overflow-y-auto px-3 py-5">
      {NAV_SECTIONS.map((section) => (
        <div key={section.heading} className="space-y-1">
          {!sidebarCollapsed && section.heading && (
            <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {section.heading}
            </p>
          )}
          {section.links.map((link) => renderNavItem(link))}
        </div>
      ))}

      <div className="mt-auto space-y-1 border-t border-slate-200 pt-4">
        {renderNavItem(SETTINGS_LINK)}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Accessible Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-md focus:shadow-md focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Skip to main content
      </a>

      <header role="banner" className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="h-16 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Toggle */}
            <button
              ref={hamburgerBtnRef}
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>

            <Link
              to="/dashboard"
              className="flex items-center space-x-2 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-md"
              title="Go to dashboard"
            >
              <span className="text-lg font-bold bg-linear-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                AI Scientific Journal
              </span>
            </Link>
          </div>

          {/* User Profile, Command Palette trigger & Sign Out */}
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette"
              aria-haspopup="dialog"
              className="hidden sm:flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 text-xs text-slate-400 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="font-medium">Search…</span>
              <kbd className="text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 rounded px-1 py-0.5">
                Ctrl K
              </kbd>
            </button>

            {currentUser && (
              <div className="flex items-center space-x-2 text-xs text-slate-600 bg-slate-50 py-1 px-2.5 rounded-full border border-slate-200">
                <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px]">
                  {userInitial}
                </div>
                <span className="max-w-[150px] truncate font-medium">
                  {currentUser.displayName || currentUser.email}
                </span>
              </div>
            )}
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
              title="Sign out of your account"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            id="mobile-nav-drawer"
            aria-label="Mobile navigation"
            className="md:hidden fixed inset-0 top-16 z-30 bg-slate-900/40 backdrop-blur-xs flex flex-col"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              ref={drawerRef}
              className="bg-white border-b border-slate-200 p-4 space-y-2 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {currentUser && (
                <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg border border-slate-200 mb-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                    {userInitial}
                  </div>
                  <div className="truncate">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {currentUser.displayName || "Researcher"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
                  </div>
                </div>
              )}

              {NAV_SECTIONS.map((section) => (
                <div key={section.heading}>
                  {section.heading && (
                    <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {section.heading}
                    </p>
                  )}
                  <div className="space-y-1">
                    {section.links.map((link) => renderNavItem(link, () => setMobileMenuOpen(false)))}
                  </div>
                </div>
              ))}

              <div className="pt-3 mt-2 border-t border-slate-200 space-y-1">
                {renderNavItem(SETTINGS_LINK, () => setMobileMenuOpen(false))}
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    signOut();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      <div className="flex">
        {/* Desktop persistent sidebar (guidelines §4–§5), full height under header */}
        <aside
          aria-label="Sidebar navigation"
          className={`hidden md:flex md:flex-col md:fixed md:top-16 md:bottom-0 md:left-0 border-r border-slate-200 bg-white transition-[width] duration-200 ${
            sidebarCollapsed ? "md:w-16" : "md:w-60"
          }`}
        >
          {sidebarContent}

          {/* Collapse toggle pinned at the sidebar bottom */}
          <div className="border-t border-slate-200 p-2">
            <button
              type="button"
              onClick={toggleSidebar}
              aria-pressed={sidebarCollapsed}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="w-full flex items-center justify-center rounded-md p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
              {!sidebarCollapsed && (
                <span className="ml-2.5 text-xs font-medium">Collapse</span>
              )}
            </button>
          </div>
        </aside>

        <main
          id="main-content"
          role="main"
          className={`flex-1 w-full transition-[padding] duration-200 ${
            sidebarCollapsed ? "md:pl-16" : "md:pl-60"
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
};
