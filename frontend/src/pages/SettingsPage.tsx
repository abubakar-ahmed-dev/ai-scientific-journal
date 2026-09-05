import { useEffect, useState } from "react";
import { fetchMe, updateMe } from "../lib/api";
import type { UserProfile } from "../lib/api";
import { Layout } from "../components/Layout";

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Editable fields
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [timezone, setTimezone] = useState("UTC");
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState(true);

  useEffect(() => {
    fetchMe()
      .then((res) => {
        setProfile(res.data);
        setDisplayName(res.data.displayName || "");
        setPhotoURL(res.data.photoURL || "");
        setTheme(res.data.preferences?.theme || "system");
        setTimezone(res.data.preferences?.timezone || "UTC");
        setLocationEnabled(res.data.preferences?.locationEnabled ?? true);
        setAiSuggestionsEnabled(res.data.preferences?.aiSuggestionsEnabled ?? true);
      })
      .catch((err) => {
        setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to load profile" });
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await updateMe({
        displayName,
        // API.md §6.2: photoURL must be a valid HTTPS URL when present — omit
        // the key entirely rather than sending null (the schema is
        // .optional(), not nullable, and empty string is invalid).
        ...(photoURL.trim() ? { photoURL: photoURL.trim() } : {}),
        preferences: {
          theme,
          timezone,
          locationEnabled,
          aiSuggestionsEnabled,
        },
      });
      setProfile(res.data);
      setMessage({ type: "success", text: "Profile and preferences updated successfully." });
      // Transient inline "Saved" state (guidelines §38): reassures without a toast.
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2500);
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to update profile" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Profile & Settings</h1>
          <p className="text-sm text-slate-500">
            Manage your researcher profile, timezone, and journal preferences.
          </p>
        </div>

        {message && (
          <div
            className={`p-4 rounded-md text-sm ${
              message.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-red-50 border border-red-200 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading settings...</div>
        ) : (
          <form onSubmit={handleSave} className="bg-white p-6 sm:p-8 rounded-lg border border-slate-200 shadow-sm space-y-6">
            {/* Read-Only Account Details */}
            <div className="bg-slate-50 p-4 rounded-md border border-slate-200 space-y-2 text-xs text-slate-600">
              <div>
                <strong>Firebase UID:</strong> {profile?.ownerId}
              </div>
              <div>
                <strong>Email:</strong> {profile?.email}
              </div>
              <div className="flex gap-4">
                <span>
                  <strong>Role:</strong> {profile?.role} (server-managed)
                </span>
                <span>
                  <strong>Status:</strong> {profile?.accountStatus}
                </span>
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
              <input
                type="text"
                required
                maxLength={100}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Photo URL */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Photo URL (HTTPS)</label>
              <input
                type="url"
                placeholder="https://example.com/avatar.jpg"
                value={photoURL}
                onChange={(e) => setPhotoURL(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Preferences */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <h2 className="text-sm font-semibold text-slate-800">Application Preferences</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Theme</label>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                  >
                    <option value="system">System Default</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Timezone</label>
                  <input
                    type="text"
                    placeholder="UTC or America/New_York"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="locToggle"
                    checked={locationEnabled}
                    onChange={(e) => setLocationEnabled(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 border-slate-300 rounded"
                  />
                  <label htmlFor="locToggle" className="text-sm text-slate-700">
                    Enable geographic location capture by default
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="aiToggle"
                    checked={aiSuggestionsEnabled}
                    onChange={(e) => setAiSuggestionsEnabled(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 border-slate-300 rounded"
                  />
                  <label htmlFor="aiToggle" className="text-sm text-slate-700">
                    Show AI suggestions and insights
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                aria-live="polite"
                className={`px-6 py-2 text-white rounded text-sm font-medium transition disabled:opacity-50 ${
                  justSaved && !saving ? "bg-emerald-600" : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {saving ? "Saving..." : justSaved ? "✓ Saved" : "Save Preferences"}
              </button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  );
}
