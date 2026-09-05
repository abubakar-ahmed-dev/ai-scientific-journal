import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, LogOut } from "lucide-react";
import { useAuth } from "../lib/firebase/authContext";

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, signOut } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [prevPath, setPrevPath] = useState(location.pathname);
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const hamburgerBtnRef = React.useRef<HTMLButtonElement>(null);

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

  const navLinks = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/observations", label: "Observations" },
    { to: "/map", label: "Research Map" },
    { to: "/ask", label: "Ask Journal" },
    { to: "/tasks", label: "Tasks" },
    { to: "/conversations", label: "AI Chat" },
    { to: "/projects", label: "Projects" },
    { to: "/settings", label: "Settings" },
  ];

  const userInitial = (currentUser?.displayName?.[0] || currentUser?.email?.[0] || "U").toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Accessible Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-md focus:shadow-md focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Skip to main content
      </a>

      <header role="banner" className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4 sm:space-x-8">
            {/* Mobile Hamburger Toggle */}
            <button
              ref={hamburgerBtnRef}
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>

            <Link
              to="/"
              className="flex items-center space-x-2 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 rounded-md"
              title="Go to homepage"
            >
              <span className="text-xl font-bold bg-linear-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                AI Scientific Journal
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav aria-label="Main Navigation" className="hidden md:flex space-x-1 lg:space-x-2">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.to || (link.to !== "/dashboard" && location.pathname.startsWith(link.to));
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700 font-semibold shadow-2xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User Profile & Sign Out (Desktop) */}
          <div className="flex items-center space-x-3">
            {currentUser && (
              <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-600 bg-slate-50 py-1 px-2.5 rounded-full border border-slate-200">
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
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
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

              <nav aria-label="Mobile Navigation" className="space-y-1">
                {navLinks.map((link) => {
                  const isActive = location.pathname === link.to || (link.to !== "/dashboard" && location.pathname.startsWith(link.to));
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-3 py-2.5 rounded-md text-sm font-medium transition ${
                        isActive
                          ? "bg-indigo-50 text-indigo-700 font-semibold"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="pt-3 border-t border-slate-200">
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

      <main id="main-content" role="main" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};
