import React from "react";

/**
 * Minimal, dependency-free markdown renderer for AI-authored chat text.
 *
 * Security posture (SECURITY.md: AI output is untrusted input):
 * - Output is built from React elements and plain text nodes only. There is no
 *   dangerouslySetInnerHTML anywhere in this component, so no HTML/script can
 *   be injected through model output.
 * - Links are restricted to http/https and get rel="noreferrer noopener" +
 *   target="_blank".
 * - Only a deliberately small markdown subset is supported (headings, bold,
 *   italic, inline code, fenced code blocks, lists, links, blockquotes) —
 *   anything else passes through as literal text.
 *
 * This is intentionally scoped to AI-authored content. User-typed messages
 * keep their plain-text rendering so user content and AI content remain
 * visually distinct.
 */

const INLINE_CODE_PATTERN = /`([^`]+)`/;
const BOLD_PATTERN = /\*\*([^*]+)\*\*|__([^_]+)__/;
const ITALIC_PATTERN = /\*([^*]+)\*|_([^_]+)_/;
const LINK_PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)/;

/** Parse one line of inline markdown into React nodes. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Find the earliest inline construct; ties broken by order below.
    const candidates: Array<{ start: number; kind: string; match: RegExpMatchArray }> = [];

    const code = remaining.match(INLINE_CODE_PATTERN);
    if (code && code.index !== undefined) candidates.push({ start: code.index, kind: "code", match: code });

    const bold = remaining.match(BOLD_PATTERN);
    if (bold && bold.index !== undefined) candidates.push({ start: bold.index, kind: "bold", match: bold });

    const italic = remaining.match(ITALIC_PATTERN);
    if (italic && italic.index !== undefined) candidates.push({ start: italic.index, kind: "italic", match: italic });

    const link = remaining.match(LINK_PATTERN);
    if (link && link.index !== undefined) candidates.push({ start: link.index, kind: "link", match: link });

    if (candidates.length === 0) {
      nodes.push(remaining);
      break;
    }

    candidates.sort((a, b) => a.start - b.start);
    const { kind, match, start } = candidates[0];

    if (start > 0) {
      nodes.push(remaining.slice(0, start));
    }

    if (kind === "code") {
      nodes.push(
        <code
          key={`${keyPrefix}-c${key}`}
          className="px-1 py-0.5 mx-0.5 rounded bg-slate-100 text-slate-700 text-[0.85em] font-mono"
        >
          {match[1]}
        </code>
      );
      remaining = remaining.slice(match.index! + match[0].length);
    } else if (kind === "bold") {
      nodes.push(
        <strong key={`${keyPrefix}-b${key}`} className="font-semibold text-slate-900">
          {match[1] ?? match[2]}
        </strong>
      );
      remaining = remaining.slice(match.index! + match[0].length);
    } else if (kind === "italic") {
      nodes.push(
        <em key={`${keyPrefix}-i${key}`}>{match[1] ?? match[2]}</em>
      );
      remaining = remaining.slice(match.index! + match[0].length);
    } else {
      // Link
      const label = match[1];
      const href = match[2];
      const isSafe = /^https?:\/\//i.test(href);
      nodes.push(
        isSafe ? (
          <a
            key={`${keyPrefix}-l${key}`}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-brand-600 underline underline-offset-2 hover:text-brand-800"
          >
            {label}
          </a>
        ) : (
          label
        )
      );
      remaining = remaining.slice(match.index! + match[0].length);
    }
    key += 1;
  }

  return nodes;
}

/** Fenced code block rendered literally (no markup interpretation inside). */
function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="my-2 p-3 rounded-lg bg-slate-900 text-slate-100 text-xs overflow-x-auto">
      <code>{code}</code>
    </pre>
  );
}

export const MarkdownText: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (/^```/.test(line)) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; // consume closing fence (or EOF)
      blocks.push(<CodeBlock key={`k${blockKey++}`} code={codeLines.join("\n")} />);
      continue;
    }

    // Heading (# .. ######)
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const text = renderInline(heading[2], `h${blockKey}`);
      const sizes: Record<number, string> = {
        1: "text-base font-bold",
        2: "text-[15px] font-bold",
        3: "text-sm font-bold",
        4: "text-sm font-semibold",
        5: "text-xs font-semibold",
        6: "text-xs font-semibold",
      };
      const Tag = (`h${Math.min(level, 6)}` as unknown) as keyof React.JSX.IntrinsicElements;
      blocks.push(
        <Tag key={`k${blockKey++}`} className={`${sizes[level]} mt-2 mb-1 first:mt-0 text-slate-900`}>
          {text}
        </Tag>
      );
      i += 1;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={`k${blockKey++}`}
          className="my-2 pl-3 border-l-2 border-slate-300 text-slate-600 space-y-1"
        >
          {quoteLines.map((l, idx) => (
            <p key={`q${idx}`}>{renderInline(l, `q${blockKey}-${idx}`)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={`k${blockKey++}`} className="my-1.5 ml-4 list-disc space-y-1">
          {items.map((item, idx) => (
            <li key={`u${idx}`}>{renderInline(item, `u${blockKey}-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={`k${blockKey++}`} className="my-1.5 ml-4 list-decimal space-y-1">
          {items.map((item, idx) => (
            <li key={`o${idx}`}>{renderInline(item, `o${blockKey}-${idx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Blank line → paragraph separator
    if (/^\s*$/.test(line)) {
      i += 1;
      continue;
    }

    // Paragraph: gather consecutive non-structural lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={`k${blockKey++}`} className="my-1.5 first:mt-0 last:mb-0">
        {paraLines.map((l, idx) => (
          <React.Fragment key={`p${idx}`}>
            {idx > 0 && <br />}
            {renderInline(l, `p${blockKey}-${idx}`)}
          </React.Fragment>
        ))}
      </p>
    );
  }

  return <div className="space-y-0.5">{blocks}</div>;
};
