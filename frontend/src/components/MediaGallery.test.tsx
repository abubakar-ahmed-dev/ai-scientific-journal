import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MediaGallery } from "./MediaGallery";
import * as api from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    fetchObservationMedia: vi.fn(),
    uploadObservationMedia: vi.fn(),
    deleteObservationMedia: vi.fn(),
  };
});

describe("MediaGallery Component", () => {
  const observationId = "obs-test-101";
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  function renderGallery() {
    return render(
      <QueryClientProvider client={queryClient}>
        <MediaGallery observationId={observationId} />
      </QueryClientProvider>
    );
  }

  it("renders empty state message when no media items are attached", async () => {
    vi.mocked(api.fetchObservationMedia).mockResolvedValueOnce([]);

    renderGallery();

    expect(screen.getByText(/loading evidence media/i)).toBeInTheDocument();
    expect(
      await screen.findByText(/no media files attached to this observation yet/i)
    ).toBeInTheDocument();
  });

  it("renders image, audio, and video items with captions and type badges", async () => {
    vi.mocked(api.fetchObservationMedia).mockResolvedValueOnce([
      {
        id: "med-1",
        ownerId: "user-1",
        observationId,
        type: "image",
        fileName: "hawk.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1048576, // 1 MB
        caption: "Hawk in flight",
        createdAt: "2026-06-01T10:00:00Z",
        url: "https://example.com/hawk.jpg",
      },
      {
        id: "med-2",
        ownerId: "user-1",
        observationId,
        type: "audio",
        fileName: "song.mp3",
        mimeType: "audio/mpeg",
        sizeBytes: 524288, // 512 KB
        caption: "Dawn chorus audio",
        createdAt: "2026-06-01T10:05:00Z",
        url: "https://example.com/song.mp3",
      },
      {
        id: "med-3",
        ownerId: "user-1",
        observationId,
        type: "video",
        fileName: "dive.mp4",
        mimeType: "video/mp4",
        sizeBytes: 10485760, // 10 MB
        caption: "High speed dive",
        createdAt: "2026-06-01T10:10:00Z",
        url: "https://example.com/dive.mp4",
      },
    ]);

    renderGallery();

    expect(await screen.findByText("Hawk in flight")).toBeInTheDocument();
    expect(screen.getByText("Dawn chorus audio")).toBeInTheDocument();
    expect(screen.getByText("High speed dive")).toBeInTheDocument();

    expect(screen.getByText("1.0 MB")).toBeInTheDocument();
    expect(screen.getByText("512.0 KB")).toBeInTheDocument();
    expect(screen.getByText("10.0 MB")).toBeInTheDocument();

    // Verify type tags
    expect(screen.getByText("image")).toBeInTheDocument();
    expect(screen.getByText("audio")).toBeInTheDocument();
    expect(screen.getByText("video")).toBeInTheDocument();
  });

  it("uploads a selected file and updates gallery items", async () => {
    // The gallery refetches after mutations (invalidateQueries), so the mock
    // models server state that changes instead of one-shot resolved values.
    const store: api.ObservationMedia[] = [];
    vi.mocked(api.fetchObservationMedia).mockImplementation(async () => store);
    vi.mocked(api.uploadObservationMedia).mockImplementation(async () => {
      const created: api.ObservationMedia = {
        id: "med-new",
        ownerId: "user-1",
        observationId,
        type: "image",
        fileName: "field-sample.png",
        mimeType: "image/png",
        sizeBytes: 2048,
        caption: "Sample under field microscope",
        createdAt: "2026-06-01T11:00:00Z",
        url: "https://example.com/sample.png",
      };
      store.push(created);
      return created;
    });

    renderGallery();
    await screen.findByText(/no media files attached/i);

    const file = new File(["dummy content"], "field-sample.png", { type: "image/png" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    const captionInput = screen.getByPlaceholderText(/adult female resting/i);
    fireEvent.change(captionInput, { target: { value: "Sample under field microscope" } });

    const submitBtn = screen.getByRole("button", { name: /upload to observation/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.uploadObservationMedia).toHaveBeenCalledWith(
        observationId,
        file,
        "Sample under field microscope"
      );
    });

    expect(await screen.findByText("Sample under field microscope")).toBeInTheDocument();
  });

  it("rejects an oversized file client-side using the shared media limits", async () => {
    vi.mocked(api.fetchObservationMedia).mockResolvedValue([]);

    renderGallery();
    await screen.findByText(/no media files attached/i);

    const oversized = new File(["x".repeat(11 * 1024 * 1024)], "big.png", { type: "image/png" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [oversized] } });

    expect(
      await screen.findByText(/image size exceeds 10 mb limit/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload to observation/i })).toBeDisabled();
  });

  it("deletes a media item through confirmation modal", async () => {
    // Server state model: the item exists until deleteMutation triggers refetch
    const store: api.ObservationMedia[] = [
      {
        id: "med-delete",
        ownerId: "user-1",
        observationId,
        type: "image",
        fileName: "delete-me.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
        caption: "Obsolete picture",
        createdAt: "2026-06-01T12:00:00Z",
        url: "https://example.com/delete.jpg",
      },
    ];
    vi.mocked(api.fetchObservationMedia).mockImplementation(async () => store);
    vi.mocked(api.deleteObservationMedia).mockImplementation(async () => {
      store.pop();
    });

    renderGallery();
    expect(await screen.findByText("Obsolete picture")).toBeInTheDocument();

    const deleteBtn = screen.getByRole("button", { name: /delete media item/i });
    fireEvent.click(deleteBtn);

    // Modal appears
    expect(screen.getByText(/permanently delete this media file/i)).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: /confirm delete/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.deleteObservationMedia).toHaveBeenCalledWith(observationId, "med-delete");
    });

    expect(await screen.findByText(/no media files attached/i)).toBeInTheDocument();
  });
});
