import React, { useState, useEffect } from "react";
import { X, History, GitCompare, Calendar, User } from "lucide-react";
import type { ObservationVersion, Observation } from "../lib/api";

interface VersionSnapshotModalProps {
  version: ObservationVersion | null;
  currentObservation: Observation | null;
  onClose: () => void;
}

export const VersionSnapshotModal: React.FC<VersionSnapshotModalProps> = ({
  version,
  currentObservation,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"details" | "compare">("details");
  const modalRef = React.useRef<HTMLDivElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus first focusable element on open
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && focusable.length > 0) {
      focusable[0]?.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
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
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  if (!version) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="snapshot-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
              v{version.version}
            </div>
            <div>
              <h2 id="snapshot-modal-title" className="text-base font-bold text-slate-900">
                Revision Snapshot v{version.version}
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(version.editedAt).toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Editor: {version.editedBy.slice(0, 8)}...
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition"
            aria-label="Close revision snapshot modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 border-b border-slate-200 flex space-x-4">
          <button
            type="button"
            onClick={() => setActiveTab("details")}
            className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
              activeTab === "details"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Snapshot Details</span>
          </button>

          {currentObservation && (
            <button
              type="button"
              onClick={() => setActiveTab("compare")}
              className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
                activeTab === "compare"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Compare with Current (v{currentObservation.version})</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {activeTab === "details" ? (
            <div className="space-y-4">
              {version.changeReason && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                  <span className="font-semibold">Reason for change:</span> {version.changeReason}
                </div>
              )}

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Title
                </h3>
                <p className="text-base font-semibold text-slate-900">{version.title}</p>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Description
                </h3>
                <p className="text-slate-800 whitespace-pre-wrap bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs leading-relaxed">
                  {version.description}
                </p>
              </div>

              {version.hypothesis && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Hypothesis at this revision
                  </h3>
                  <p className="text-indigo-950 bg-indigo-50/60 p-3 rounded-lg border border-indigo-100 text-xs leading-relaxed">
                    {version.hypothesis}
                  </p>
                </div>
              )}

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Measurements ({version.measurements?.length || 0})
                </h3>
                {!version.measurements || version.measurements.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No scientific measurements recorded in this snapshot.</p>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                      <thead className="bg-slate-50 font-semibold text-slate-600">
                        <tr>
                          <th className="px-3 py-2">Measurement</th>
                          <th className="px-3 py-2">Value</th>
                          <th className="px-3 py-2">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {version.measurements.map((m, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-medium text-slate-800">{m.name}</td>
                            <td className="px-3 py-2 font-mono text-slate-900">{m.value}</td>
                            <td className="px-3 py-2 text-slate-500">{m.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Comparison Tab */
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Historical Revision Card */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      Revision v{version.version}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(version.editedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 font-medium">Title</p>
                    <p className="text-sm font-semibold text-slate-800">{version.title}</p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 font-medium">Description</p>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap line-clamp-4 bg-white p-2.5 rounded border border-slate-200">
                      {version.description}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 font-medium">
                      Measurements: {version.measurements?.length || 0}
                    </p>
                  </div>
                </div>

                {/* Current Active Observation Card */}
                {currentObservation && (
                  <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                        Current (v{currentObservation.version})
                      </span>
                      <span className="text-[10px] text-emerald-700">Active</span>
                    </div>

                    <div>
                      <p className="text-xs text-emerald-800 font-medium">Title</p>
                      <p className="text-sm font-semibold text-slate-900">{currentObservation.title}</p>
                    </div>

                    <div>
                      <p className="text-xs text-emerald-800 font-medium">Description</p>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap line-clamp-4 bg-white p-2.5 rounded border border-emerald-200">
                        {currentObservation.description}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-emerald-800 font-medium">
                        Measurements: {currentObservation.measurements?.length || 0}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition shadow-2xs"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
