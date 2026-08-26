import React from "react";

export function PersonMark({
  initials,
  size = "sm",
  active,
}: {
  initials?: string;
  size?: "sm" | "md" | "lg";
  active?: boolean;
}) {
  const dims =
    size === "lg"
      ? "h-9 w-9 text-[0.8rem]"
      : size === "md"
        ? "h-[1.6rem] w-[1.6rem] text-[0.66rem]"
        : "h-[1.35rem] w-[1.35rem] text-[0.6rem]";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide transition-colors duration-150 ${dims} ${
        active
          ? "bg-[rgba(108,140,255,0.32)] text-[#e6ecff]"
          : "bg-white/[0.07] text-[var(--text-secondary)]"
      }`}
      aria-hidden
    >
      {initials}
    </span>
  );
}
