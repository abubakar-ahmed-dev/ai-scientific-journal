import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConfirmDialog } from "./ConfirmDialog";
import { ToastProvider, useToast } from "./Toast";

describe("ConfirmDialog", () => {
  it("renders consequence message and calls only the clicked action", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Delete project?"
        destructive
        confirmLabel="Delete Project"
        message={<p>Observations will be kept as unfiled.</p>}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByRole("dialog", { name: "Delete project?" })).toBeInTheDocument();
    expect(screen.getByText("Observations will be kept as unfiled.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete Project" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not render when closed", () => {
    render(
      <ConfirmDialog
        open={false}
        title="Hidden"
        message={<p>x</p>}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Escape cancels the dialog", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Escape test"
        message={<p>x</p>}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("ToastProvider", () => {
  function ToastProbe() {
    const toast = useToast();
    return (
      <>
        <button onClick={() => toast.success("Saved ok")}>t-success</button>
        <button onClick={() => toast.error("Failed badly")}>t-error</button>
      </>
    );
  }

  it("shows success and error toasts and dismisses on click", async () => {
    render(
      <ToastProvider>
        <ToastProbe />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "t-success" }));
    fireEvent.click(screen.getByRole("button", { name: "t-error" }));

    expect(screen.getByRole("status")).toHaveTextContent("Saved ok");
    expect(screen.getByRole("alert")).toHaveTextContent("Failed badly");

    // Manual dismissal removes a toast
    fireEvent.click(screen.getAllByRole("button", { name: /dismiss notification/i })[0]);
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("auto-dismisses toasts after their timeout", async () => {
    render(
      <ToastProvider>
        <ToastProbe />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "t-success" }));
    expect(screen.getByRole("status")).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      },
      { timeout: 6000 }
    );
  });

  it("throws outside a provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    function Orphan() {
      useToast();
      return null;
    }
    expect(() => render(<Orphan />)).toThrow(/useToast must be used within a ToastProvider/);
    consoleError.mockRestore();
  });
});
