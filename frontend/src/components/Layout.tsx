import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/firebase/authContext";

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, signOut } = useAuth();
  const location = useLocation();

  const navLinks = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/observations", label: "Observations" },
    { to: "/ask", label: "Ask Journal" },
    { to: "/tasks", label: "Tasks" },
    { to: "/conversations", label: "AI Chat" },
    { to: "/projects", label: "Projects" },
    { to: "/settings", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <span className="text-xl font-bold text-indigo-600">AI Scientific Journal</span>
            </Link>
            <nav className="hidden md:flex space-x-4">
              {navLinks.map((link) => {
                const isActive = location.pathname.startsWith(link.to);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700 font-semibold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            {currentUser && (
              <span className="text-xs text-slate-500 hidden sm:inline">
                {currentUser.email || currentUser.displayName}
              </span>
            )}
            <button
              onClick={() => signOut()}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};
