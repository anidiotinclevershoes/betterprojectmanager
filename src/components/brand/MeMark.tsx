/**
 * Shared Lume / AI identity mark.
 * standard and button: Page 09 Brand/AIUsageMark chip (34×24) around the
 * approved lightbulb. Page 09 does not define a larger usage chip than the
 * tab mark, so those two sizes share that chip.
 * micro: the same lightbulb with no chip, at the Page 09 compact glyph size,
 * for inline text. Decorative — the surrounding control already has a name.
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
      <img src="/brand/lume-ai-lightbulb.svg" alt="" width={18} height={18} />
    </span>
  );
}
