import React, { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ObservationMedia } from "../lib/api";
import {
  fetchObservationMedia,
  uploadObservationMedia,
  deleteObservationMedia,
} from "../lib/api";
import { MEDIA_SIZE_LIMITS, detectClientMediaType } from "../lib/mediaLimits";
import {
  Image as ImageIcon,
  Music,
  Video,
  UploadCloud,
  Trash2,
  Loader2,
  X,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface MediaGalleryProps {
  observationId: string;
  onMediaCountChange?: (count: number) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function humanLimit(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export const MediaGallery: React.FC<MediaGalleryProps> = ({
  observationId,
  onMediaCountChange,
}) => {
  const queryClient = useQueryClient();

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox modal state
  const [lightboxImage, setLightboxImage] = useState<{ url: string; caption?: string | null } | null>(null);

  // Delete modal state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const mediaQuery = useQuery<ObservationMedia[]>({
    queryKey: ["observationMedia", observationId],
    queryFn: () => fetchObservationMedia(observationId),
  });

  const mediaList = mediaQuery.data ?? [];

  // Keep the parent's mediaCount in sync from the query data (single source
  // of truth — no stale-closure arithmetic).
  useMemo(() => {
    onMediaCountChange?.(mediaList.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaList.length]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["observationMedia", observationId] });

  // Signed URLs expire (≤ 15 min, API.md §6.8). On a media element error
  // (expired/failed URL) refetch fresh URLs instead of leaving the gallery
  // permanently broken until a full page reload.
  const handleMediaUrlError = () => {
    if (!mediaQuery.isFetching) {
      invalidate();
    }
  };

  const uploadMutation = useMutation({
    mutationFn: (input: { file: File; caption: string }) =>
      uploadObservationMedia(observationId, input.file, input.caption || undefined),
    onSuccess: async () => {
      setSelectedFile(null);
      setCaption("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await invalidate();
    },
    onError: (err) => {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (mediaId: string) => deleteObservationMedia(observationId, mediaId),
    onSuccess: async () => {
      setDeletingId(null);
      await invalidate();
    },
    onError: (err) => {
      setUploadError(err instanceof Error ? err.message : "Failed to delete media item.");
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const mediaType = detectClientMediaType(file.type);
    if (!mediaType) {
      setUploadError("Unsupported file type. Please choose an image, audio file, or MP4 video.");
      setSelectedFile(null);
      return;
    }

    const limit = MEDIA_SIZE_LIMITS[mediaType];
    if (file.size > limit) {
      setUploadError(
        `${mediaType[0]!.toUpperCase()}${mediaType.slice(1)} size exceeds ${humanLimit(limit)} limit.`
      );
      setSelectedFile(null);
      return;
    }

    setUploadError(null);
    setSelectedFile(file);
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || uploadMutation.isPending) return;
    uploadMutation.mutate({ file: selectedFile, caption });
  };

  const error = mediaQuery.error instanceof Error ? mediaQuery.error.message : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-indigo-600" />
          <span>Evidence Media Gallery ({mediaList.length})</span>
        </h3>
        <span className="text-xs text-slate-400">Private encrypted evidence storage</span>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Media Cards Grid */}
      {mediaQuery.isLoading ? (
        <div className="p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading evidence media...</span>
        </div>
      ) : mediaList.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-500 text-sm">
          No media files attached to this observation yet. Upload photos, sound recordings, or video evidence below.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mediaList.map((item) => (
            <div
              key={item.id}
              className="group relative bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between hover:shadow-xs transition"
            >
              {/* Media Content */}
              <div className="bg-slate-900/5 aspect-video flex items-center justify-center relative overflow-hidden">
                {item.type === "image" ? (
                  <button
                    type="button"
                    onClick={() => setLightboxImage({ url: item.url || "", caption: item.caption })}
                    className="w-full h-full cursor-zoom-in"
                  >
                    {item.url ? (
                      <img
                        src={item.url}
                        alt={item.caption || item.fileName}
                        onError={handleMediaUrlError}
                        className="w-full h-full object-cover group-hover:scale-102 transition duration-200"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 gap-1 text-xs">
                        <ImageIcon className="w-6 h-6" />
                        <span>Image</span>
                      </div>
                    )}
                  </button>
                ) : item.type === "audio" ? (
                  <div className="p-4 w-full flex flex-col items-center justify-center gap-2">
                    <Music className="w-8 h-8 text-indigo-500" />
                    {item.url ? (
                      <audio controls src={item.url} onError={handleMediaUrlError} className="w-full h-8" />
                    ) : (
                      <span className="text-xs text-slate-400">Audio ready</span>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-black">
                    {item.url ? (
                      <video controls src={item.url} onError={handleMediaUrlError} className="w-full h-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center text-slate-400 gap-1 text-xs">
                        <Video className="w-6 h-6" />
                        <span>Video</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Type Badge */}
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-900/70 text-white backdrop-blur-xs">
                  {item.type}
                </span>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => setDeletingId(item.id)}
                  aria-label="Delete media item"
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 hover:bg-red-50 text-slate-600 hover:text-red-600 transition shadow-xs opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Card Meta & Caption */}
              <div className="p-3.5 space-y-1.5 flex-1 flex flex-col justify-between">
                <div>
                  {item.caption ? (
                    <p className="text-xs font-medium text-slate-800 line-clamp-2">{item.caption}</p>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No caption provided</p>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                  <span className="truncate max-w-[140px]" title={item.fileName}>
                    {item.fileName}
                  </span>
                  <span>{formatBytes(item.sizeBytes)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Dropzone & Form */}
      <form onSubmit={handleUpload} className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
        <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
          <UploadCloud className="w-4 h-4 text-indigo-600" />
          <span>Upload Evidence File</span>
        </h4>

        {uploadError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Select File</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,audio/*,video/mp4"
              onChange={handleFileSelect}
              disabled={uploadMutation.isPending}
              className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Image ≤ {humanLimit(MEDIA_SIZE_LIMITS.image)} &bull; Audio ≤ {humanLimit(MEDIA_SIZE_LIMITS.audio)} &bull; Video ≤ {humanLimit(MEDIA_SIZE_LIMITS.video)}
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Caption / Field Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Adult female resting on high bough"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={uploadMutation.isPending}
              maxLength={500}
              className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!selectedFile || uploadMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition shadow-2xs cursor-pointer"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Uploading evidence...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload to Observation</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              aria-label="Close image modal"
              className="absolute -top-10 right-0 p-2 text-white hover:text-slate-300 transition"
            >
              <X className="w-6 h-6" />
            </button>
            {lightboxImage.url ? (
              <img
                src={lightboxImage.url}
                alt={lightboxImage.caption || "Observation evidence"}
                onError={handleMediaUrlError}
                className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-slate-300">
                <ImageIcon className="w-10 h-10" />
                <span className="text-sm">Image URL unavailable.</span>
                <button
                  type="button"
                  onClick={handleMediaUrlError}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh URL</span>
                </button>
              </div>
            )}
            {lightboxImage.caption && (
              <p className="mt-3 text-sm text-white text-center bg-slate-900/60 px-4 py-1.5 rounded-full">
                {lightboxImage.caption}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h4 className="text-base font-bold text-slate-900">Delete Evidence File</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete this media file? This will remove the Cloud Storage binary and update your observation record.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                disabled={deleteMutation.isPending}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deletingId)}
                disabled={deleteMutation.isPending}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
