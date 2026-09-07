import { Sparkles, MapPin, ListTodo } from "lucide-react";

interface PreviewCard {
  icon: typeof Sparkles;
  title: string;
  description: string;
  chip: string;
}

const PREVIEWS: PreviewCard[] = [
  {
    icon: Sparkles,
    title: "AI Analysis",
    description: "Have Gemini interpret an observation once it's recorded.",
    chip: "bg-purple-50 text-purple-600",
  },
  {
    icon: MapPin,
    title: "Research Map",
    description: "See where your observations happened, at the precision you choose.",
    chip: "bg-blue-50 text-blue-600",
  },
  {
    icon: ListTodo,
    title: "Research Tasks",
    description: "Turn findings into follow-up investigations you accept yourself.",
    chip: "bg-amber-50 text-amber-600",
  },
];

/**
 * Feature previews for the new-user state (plan §5.1): what each tool does
 * once there is data to use it on. Nothing is locked — the sidebar stays
 * reachable — so the copy describes the tool instead of gating it.
 * Informational only, no fake affordances.
 */
export function FeaturePreviews() {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 px-1">
        As your journal grows
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PREVIEWS.map((card) => (
          <div
            key={card.title}
            className="p-5 bg-white border border-app-border rounded-xl flex items-start gap-3.5"
          >
            <span
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${card.chip}`}
            >
              <card.icon className="w-4.5 h-4.5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-app-heading">{card.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed mt-1">{card.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
