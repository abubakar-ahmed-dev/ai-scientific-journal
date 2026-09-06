import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownText } from "./MarkdownText";

describe("MarkdownText (AI chat renderer)", () => {
  it("renders plain prose as a paragraph", () => {
    render(<MarkdownText content="Empirical readings suggest non-linear saturation." />);
    expect(
      screen.getByText("Empirical readings suggest non-linear saturation.")
    ).toBeInTheDocument();
  });

  it("renders headings, bold, italic, and inline code", () => {
    render(
      <MarkdownText
        content={"## Findings\n\nThe **PAR saturation** threshold matters for *Xanthoria* growth — see `par_value`."}
      />
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Findings");
    expect(screen.getByText("PAR saturation").tagName).toBe("STRONG");
    expect(screen.getByText("Xanthoria").tagName).toBe("EM");
    expect(screen.getByText("par_value").tagName).toBe("CODE");
  });

  it("renders ordered and unordered lists", () => {
    render(
      <MarkdownText
        content={"Next steps:\n\n1. Repeat the count\n2. Record rainfall\n\n- Control site A\n- Control site B"}
      />
    );
    expect(screen.getByText("Repeat the count").tagName).toBe("LI");
    expect(screen.getByText("Control site B").tagName).toBe("LI");
    expect(screen.getAllByRole("list")).toHaveLength(2);
  });

  it("renders fenced code blocks literally without executing markup", () => {
    render(<MarkdownText content={"```\n<script>alert('x')</script>\n```"} />);
    expect(screen.getByText("<script>alert('x')</script>")).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });

  it("never injects HTML from model output (AI output is untrusted)", () => {
    render(
      <MarkdownText
        content={'<img src=x onerror="alert(1)"> <strong>should stay literal</strong>'}
      />
    );
    // Raw HTML passes through as text — no <img> or <strong> elements are created.
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText(/should stay literal/)).toBeInTheDocument();
  });

  it("allows only http(s) links with safe rel attributes", () => {
    render(
      <MarkdownText
        content={"[paper](https://example.org/paper) and [bad](javascript:alert(1))"}
      />
    );
    const link = screen.getByRole("link", { name: "paper" });
    expect(link).toHaveAttribute("href", "https://example.org/paper");
    expect(link).toHaveAttribute("rel", "noreferrer noopener");
    expect(link).toHaveAttribute("target", "_blank");
    // javascript: URLs are not rendered as links.
    expect(screen.queryByRole("link", { name: "bad" })).toBeNull();
    expect(screen.getByText(/bad/)).toBeInTheDocument();
  });
});
