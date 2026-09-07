import { useEffect, useMemo, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";
import { Camera, Trash2, AlertTriangle } from "lucide-react";
import { Layout } from "../components/Layout";
import { updateMe, uploadAvatar, removeAvatar, ApiRequestError } from "../lib/api";
import { useProfile, useInvalidateProfile } from "../lib/useProfile";

const AVATAR_MAX_MB = 2;

export default function SettingsPage() {
  const { profile, avatarUrl, isLoading } = useProfile();
  const invalidateProfile = useInvalidateProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null>(null);
  const [avatarRemove, setAvatarRemove] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Seed the form once the profile arrives (server state = baseline for
  // dirty-tracking; later refetches don't clobber in-progress edits).
  useEffect(() => {
    if (profile && !loaded) {
      setDisplayName(profile.displayName || "");
      setLocationEnabled(profile.preferences?.locationEnabled ?? true);
      setLoaded(true);
    }
  }, [profile, loaded]);

  const dirty =
    loaded &&
    (displayName !== (profile?.displayName || "") ||
      locationEnabled !== (profile?.preferences?.locationEnabled ?? true) ||
      pendingAvatar !== null ||
      avatarRemove);

  const previewAvatarUrl = avatarRemove
    ? null
    : pendingAvatarUrl ?? avatarUrl ?? null;

  // Guard against losing unsaved edits (in-app navigation + tab close).
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const displayNameError = useMemo(() => {
    const trimmed = displayName.trim();
    if (!trimmed) return "Display name is required.";
    if (trimmed.length > 100) return "Display name must be at most 100 characters.";
    return null;
  }, [displayName]);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    setLocalError(null);
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)) {
      setLocalError("Avatar must be a JPEG, PNG, WebP, or HEIC image.");
      return;
    }
    if (file.size > AVATAR_MAX_MB * 1024 * 1024) {
      setLocalError(`Avatar must be at most ${AVATAR_MAX_MB} MB.`);
      return;
    }
    setPendingAvatar(file);
    setPendingAvatarUrl(URL.createObjectURL(file));
    setAvatarRemove(false);
  }

  function handleAvatarRemove() {
    setPendingAvatar(null);
    if (pendingAvatarUrl) URL.revokeObjectURL(pendingAvatarUrl);
    setPendingAvatarUrl(null);
    setAvatarRemove(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || displayNameError) return;
    setSaving(true);
    setLocalError(null);

    try {
      if (avatarRemove) {
        await removeAvatar();
      } else if (pendingAvatar) {
        await uploadAvatar(pendingAvatar);
      }
      await updateMe({
        displayName: displayName.trim(),
        preferences: { locationEnabled },
      });
      if (pendingAvatarUrl) URL.revokeObjectURL(pendingAvatarUrl);
      setPendingAvatar(null);
      setPendingAvatarUrl(null);
      setAvatarRemove(false);
      await invalidateProfile();
    } catch (err: unknown) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to save settings";
      setLocalError(msg);
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setDisplayName(profile?.displayName || "");
    setLocationEnabled(profile?.preferences?.locationEnabled ?? true);
    setPendingAvatar(null);
    if (pendingAvatarUrl) URL.revokeObjectURL(pendingAvatarUrl);
    setPendingAvatarUrl(null);
    setAvatarRemove(false);
    setLocalError(null);
  }

  if (blocker.state === "blocked") {
    return (
      <Layout>
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Unsaved changes"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
        >
          <div className="bg-white rounded-xl shadow-xl border border-app-border w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4" />
              Unsaved changes
            </div>
            <p className="text-sm text-slate-600">
              You have unsaved changes. Leave without saving?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => blocker.reset()}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Keep editing
              </button>
              <button
                onClick={() => blocker.proceed()}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                Discard and leave
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-app-heading">Settings</h1>
          <p className="text-sm text-slate-500">
            Your researcher profile and journal defaults.
          </p>
        </div>

        {isLoading || !loaded ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading settings…</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {localError && (
              <div role="alert" className="p-4 rounded-lg text-sm bg-red-50 border border-red-200 text-red-800">
                {localError}
              </div>
            )}

            {/* Profile */}
            <section className="bg-white p-6 sm:p-8 rounded-xl border border-app-border shadow-sm space-y-5">
              <h2 className="text-sm font-semibold text-slate-800">Profile</h2>

              <div className="flex items-center gap-5">
                <div className="relative shrink-0">
                  {previewAvatarUrl ? (
                    <img
                      src={previewAvatarUrl}
                      alt="Your avatar"
                      className="w-16 h-16 rounded-full object-cover border border-app-border"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xl border border-app-border">
                      {(displayName.trim()[0] || "U").toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {previewAvatarUrl ? "Change photo" : "Upload photo"}
                  </button>
                  {previewAvatarUrl && (
                    <button
                      type="button"
                      onClick={handleAvatarRemove}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  )}
                  <span className="text-[11px] text-slate-400">
                    JPEG, PNG, or WebP · up to {AVATAR_MAX_MB} MB
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    className="sr-only"
                    aria-label="Choose avatar image"
                    onChange={handleAvatarChange}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="settings-display-name" className="block text-sm font-medium text-slate-700 mb-1">
                  Display name
                </label>
                <input
                  id="settings-display-name"
                  type="text"
                  required
                  maxLength={100}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    displayNameError ? "border-red-300" : "border-slate-300"
                  }`}
                />
                {displayNameError && (
                  <p className="mt-1 text-xs text-red-600">{displayNameError}</p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 text-sm space-y-1">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Email</span>
                  <span className="text-slate-800 font-medium truncate max-w-[60%] text-right">
                    {profile?.email}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Member since</span>
                  <span className="text-slate-800 font-medium">
                    {profile?.createdAt
                      ? new Date(profile.createdAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "long",
                        })
                      : "—"}
                  </span>
                </div>
              </div>
            </section>

            {/* Journal defaults */}
            <section className="bg-white p-6 sm:p-8 rounded-xl border border-app-border shadow-sm space-y-4">
              <h2 className="text-sm font-semibold text-slate-800">Journal defaults</h2>

              <label className="flex items-start gap-3 cursor-pointer group">
                <button
                  type="button"
                  role="switch"
                  aria-checked={locationEnabled}
                  onClick={() => setLocationEnabled((v) => !v)}
                  className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                    locationEnabled ? "bg-brand-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      locationEnabled ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span className="text-sm">
                  <span className="font-medium text-slate-800 block">
                    Capture location by default
                  </span>
                  <span className="text-slate-500 text-xs leading-relaxed">
                    New observations start with the location panel open and attempt GPS
                    capture once. You can always hide or blur a location per observation.
                  </span>
                </span>
              </label>
            </section>

            {/* Data safety */}
            <section className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-app-border text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-700">Your research data</p>
              <p>
                Observations, projects, and media are stored privately under your account and
                are never shared with other users. Deletion of a record is permanent.
              </p>
            </section>

            {/* Save bar */}
            <div className="flex items-center justify-end gap-3 pb-8">
              {dirty && (
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
                >
                  Discard
                </button>
              )}
              <button
                type="submit"
                disabled={!dirty || saving || !!displayNameError}
                aria-live="polite"
                className="px-6 py-2 text-white rounded-lg text-sm font-semibold bg-brand-600 hover:bg-brand-700 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  );
}
