import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "~/lib/utils";

export function StarRatingDisplay({
  rating,
  count,
  className,
}: {
  rating: number | null;
  count: number;
  className?: string;
}) {
  if (count === 0 || rating === null) {
    return (
      <span className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <Star className="size-3.5" />
        No ratings
      </span>
    );
  }

  return (
    <span className={cn("flex items-center gap-1 text-xs", className)}>
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < Math.round(rating);
        return (
          <Star
            key={i}
            className={cn(
              "size-3.5",
              filled
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/40"
            )}
          />
        );
      })}
      <span className="ml-0.5 font-medium">{rating.toFixed(1)}</span>
      <span className="text-muted-foreground">
        ({count})
      </span>
    </span>
  );
}

export function StarRatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value ?? 0;

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHovered(null)}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const starValue = i + 1;
        const filled = starValue <= display;
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            className={cn(
              "rounded p-0.5 transition-colors hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50",
            )}
            onMouseEnter={() => setHovered(starValue)}
            onClick={() => onChange(starValue)}
          >
            <Star
              className={cn(
                "size-5",
                filled
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground/40"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
