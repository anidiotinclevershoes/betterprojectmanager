"use client";

import { useEffect, useRef } from "react";

export function CaptureAutoTextarea({
  id,
  value,
  onChange,
  readOnly,
  disabled,
  placeholder,
  testId,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  testId?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(el.scrollHeight, 72)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      readOnly={readOnly}
      disabled={disabled}
      placeholder={placeholder}
      data-testid={testId}
      data-ai="false"
      className={`capture-textarea capture-textarea-idle capture-textarea-auto ${readOnly ? "is-readonly" : ""} ${className ?? ""}`.trim()}
      aria-readonly={readOnly || undefined}
    />
  );
}
