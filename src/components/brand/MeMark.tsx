/**
 * Brand/AIUsageMark — underlined `me`.
 * Sizes: standard (wordmark), button (inside AI actions), micro (inline Suggestions).
 * The mark belongs inside the AI control, never as a purple-filled synonym for AI.
 */
export type MeMarkSize = "standard" | "button" | "micro";

export function MeMark({
  size = "button",
  className,
}: {
  size?: MeMarkSize;
  className?: string;
}) {
  return (
    <span
      className={`lume-me-mark is-${size}${className ? ` ${className}` : ""}`}
      data-testid="lume-me-mark"
      data-me-size={size}
      aria-hidden
    >
      me
    </span>
  );
}
