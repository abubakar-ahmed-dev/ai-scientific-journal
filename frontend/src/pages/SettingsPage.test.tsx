import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import SettingsPage from "./SettingsPage";
import * as api from "../lib/api";
import { useProfile } from "../lib/useProfile";

vi.mock("../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    updateMe: vi.fn(),
    uploadAvatar: vi.fn(),
    removeAvatar: vi.fn(),
  };
});

const refetchSpy = vi.fn();
const invalidateSpy = vi.fn();

vi.mock("../lib/useProfile", async () => {
  const actual = await vi.importActual<typeof import("../lib/useProfile")>("../lib/useProfile");
  return {
    ...actual,
    useProfile: vi.fn(),
    useInvalidateProfile: () => invalidateSpy,
  };
});

function mockProfile(overrides: Record<string, unknown> = {}) {
  vi.mocked(useProfile).mockReturnValue({
    profile: {
      displayName: "olive.algae.261",
      email: "olive@example.com",
      createdAt: "2026-08-01T10:00:00Z",
      avatarUrl: null,
      preferences: { locationEnabled: true },
      ...overrides,
    } as ReturnType<typeof useProfile>["profile"],
    displayName: "olive.algae.261",
    email: "olive@example.com",
    avatarUrl: null,
    memberSince: "2026-08-01T10:00:00Z",
    preferences: { locationEnabled: true },
    isLoading: false,
    refetch: refetchSpy,
  } as ReturnType<typeof useProfile>);
  return { refetchSpy, invalidateSpy };
}

function renderPage() {
  // createMemoryRouter (not <MemoryRouter>) — useBlocker requires a data router.
  const router = createMemoryRouter(
    [{ path: "/settings", element: <SettingsPage /> }],
    { initialEntries: ["/settings"] }
  );
  return render(<RouterProvider router={router} />);
}

describe("SettingsPage (settings refactor 2026-09-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.updateMe).mockReset();
    vi.mocked(api.updateMe).mockResolvedValue({ data: {} } as never);
    vi.mocked(api.uploadAvatar).mockReset();
    vi.mocked(api.uploadAvatar).mockResolvedValue({ data: {} } as never);
    vi.mocked(api.removeAvatar).mockReset();
    vi.mocked(api.removeAvatar).mockResolvedValue({ data: {} } as never);
    URL.revokeObjectURL = vi.fn();
  });

  it("renders profile identity, journal defaults, and a clean data-safety note (no UID, no theme, no timezone)", () => {
    mockProfile();
    renderPage();

    expect(screen.getByText("olive@example.com")).toBeInTheDocument();
    expect(screen.getByText(/member since/i)).toBeInTheDocument();
    // Name renders read-only until the pencil is clicked
    expect(screen.getByText("olive.algae.261")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /display name/i })).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /capture location by default/i })).toBeChecked();

    // Removed noise must stay gone
    expect(screen.queryByText(/firebase uid/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/theme/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/timezone/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/role/i)).not.toBeInTheDocument();
  });

  it("keeps Save disabled until something changes, then saves name + preferences", async () => {
    const { invalidateSpy } = mockProfile();
    renderPage();

    const save = screen.getByRole("button", { name: /save changes/i });
    expect(save).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /edit display name/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /display name/i }), {
      target: { value: "Dr. Olive" },
    });
    expect(save).toBeEnabled();

    fireEvent.click(save);

    await waitFor(() => {
      expect(api.updateMe).toHaveBeenCalledWith({
        displayName: "Dr. Olive",
        preferences: { locationEnabled: true },
      });
    });
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("toggles the location default switch", () => {
    mockProfile();
    renderPage();

    const sw = screen.getByRole("switch", { name: /capture location by default/i });
    expect(sw).toBeChecked();
    fireEvent.click(sw);
    expect(sw).not.toBeChecked();
  });

  it("previews a selected avatar image and uploads it on save", async () => {
    mockProfile();
    renderPage();

    const input = screen.getByLabelText(/choose avatar image/i);
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "me.png", {
      type: "image/png",
    });
    // jsdom lacks createObjectURL — stub it for the preview path.
    URL.createObjectURL = vi.fn(() => "blob:preview");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByAltText(/your avatar/i)).toHaveAttribute("src", "blob:preview");
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(api.uploadAvatar).toHaveBeenCalledWith(file);
      expect(api.updateMe).toHaveBeenCalled();
    });
  });

  it("rejects an avatar over the size limit without saving", () => {
    mockProfile();
    renderPage();

    const input = screen.getByLabelText(/choose avatar image/i);
    const big = new File([new Uint8Array(3 * 1024 * 1024)], "big.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [big] } });

    expect(screen.getByText(/at most 2 MB/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
  });
});
