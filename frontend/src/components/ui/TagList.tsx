import React from "react";

interface TagListProps {
  tags: string[];
  /** Max tags rendered before the "+N" overflow chip (default 4). */
  max?: number;
  className?: string;
}

/** Hash-tag chip row for list cards. Each chip truncates at a fixed max width
 * so one long tag can never stretch the card, and the row wraps cleanly; a
 * "+N" chip summarizes the rest instead of hiding it silently. */
export const TagList: React.FC<TagListProps> = ({ tags, max = 4, className = "" }) => {
  if (tags.length === 0) return null;
  const visible = tags.slice(0, max);
  const overflow = tags.length - visible.length;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {visible.map((tag) => (
        <span
          key={tag}
          className="inline-flex max-w-[10rem] items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
          title={`#${tag}`}
        >
          <span className="truncate">#{tag}</span>
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="inline-flex items-center rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-500"
          title={tags.slice(max).map((t) => `#${t}`).join(", ")}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
};
