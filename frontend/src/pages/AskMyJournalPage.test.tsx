import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AskMyJournalPage } from "@/pages/AskMyJournalPage";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    askMyJournal: vi.fn(),
  };
});

describe("AskMyJournalPage", () => {
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

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AskMyJournalPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it("renders page header and question composer", () => {
    renderComponent();

    expect(screen.getByRole("heading", { name: /ask my journal/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/your research question/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ask journal/i })).toBeDisabled();
  });

  it("submits question and renders grounded answer, evidence, uncertainties, and provenance", async () => {
    vi.mocked(api.askMyJournal).mockResolvedValueOnce({
      answer: "Based on your journal, you observed a Red-Tailed Hawk soaring above the valley.",
      evidence: [
        {
          observationId: "obs-1",
          title: "Hawk Sighting in North Ridge",
          observedAt: "2026-05-15T10:00:00.000Z",
          note: "Direct observation of hunting behavior",
        },
      ],
      uncertainties: ["Wind conditions may have affected flight altitude."],
      model: "test-model",
      promptVersion: "ask-grounded-v1",
    });

    renderComponent();

    const textarea = screen.getByLabelText(/your research question/i);
    fireEvent.change(textarea, { target: { value: "Did I see any hawks?" } });

    const submitBtn = screen.getByRole("button", { name: /ask journal/i });
    expect(submitBtn).toBeEnabled();
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/grounded research answer/i)).toBeInTheDocument();
    expect(
      screen.getByText("Based on your journal, you observed a Red-Tailed Hawk soaring above the valley.")
    ).toBeInTheDocument();
    expect(screen.getByText("Hawk Sighting in North Ridge")).toBeInTheDocument();
    expect(screen.getByText(/supporting journal evidence \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText("Wind conditions may have affected flight altitude.")).toBeInTheDocument();
    expect(screen.getByText("test-model")).toBeInTheDocument();
    expect(screen.getByText("ask-grounded-v1")).toBeInTheDocument();
  });

  it("renders insufficient evidence notice when evidence is empty", async () => {
    vi.mocked(api.askMyJournal).mockResolvedValueOnce({
      answer: "I could not find any relevant observations in your journal to answer this question.",
      evidence: [],
      uncertainties: ["No matching observations found in journal."],
      model: "none",
      promptVersion: "ask-grounded-v1",
    });

    renderComponent();

    const textarea = screen.getByLabelText(/your research question/i);
    fireEvent.change(textarea, { target: { value: "Where are the penguins?" } });
    fireEvent.click(screen.getByRole("button", { name: /ask journal/i }));

    expect(await screen.findByText(/no direct matches in your journal records/i)).toBeInTheDocument();
    expect(
      screen.getByText("I could not find any relevant observations in your journal to answer this question.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/supporting journal evidence/i)).not.toBeInTheDocument();
  });

  it("displays error banner on failure and preserves question in textarea", async () => {
    vi.mocked(api.askMyJournal).mockRejectedValueOnce(new Error("AI service temporarily unavailable"));

    renderComponent();

    const textarea = screen.getByLabelText(/your research question/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Important research inquiry" } });
    fireEvent.click(screen.getByRole("button", { name: /ask journal/i }));

    expect(await screen.findByText(/unable to complete journal query/i)).toBeInTheDocument();
    expect(screen.getByText("AI service temporarily unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry query/i })).toBeInTheDocument();

    // Verify textarea value is preserved
    expect(textarea.value).toBe("Important research inquiry");
  });
});
