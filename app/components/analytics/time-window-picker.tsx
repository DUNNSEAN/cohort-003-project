import { Link } from "react-router";
import { cn } from "~/lib/utils";
import type { TimeWindow } from "~/services/analyticsService";

const WINDOWS: { value: TimeWindow; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All time" },
];

export function TimeWindowPicker({ current }: { current: TimeWindow }) {
  return (
    <div className="inline-flex h-9 items-center rounded-lg bg-muted p-1 gap-1">
      {WINDOWS.map((w) => (
        <Link
          key={w.value}
          to={`?window=${w.value}`}
          className={cn(
            "inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors",
            current === w.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {w.label}
        </Link>
      ))}
    </div>
  );
}
