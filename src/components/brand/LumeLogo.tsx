export function LumeLogo({
  size = 22,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M9 18h6M10 21h4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M12 2a6 6 0 0 0-3.5 10.9c.7.5 1.1 1.2 1.2 2.1h4.6c.1-.9.5-1.6 1.2-2.1A6 6 0 0 0 12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}
