"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CAPTURE_LAYOUT_DEFAULT,
  CAPTURE_LAYOUT_STORAGE_KEY,
  parseCaptureLayout,
  type CaptureLayoutExperiment,
} from "@/lib/capture/layout-experiment";

export function useCaptureLayoutExperiment(): {
  layout: CaptureLayoutExperiment;
  setLayout: (next: CaptureLayoutExperiment) => void;
} {
  const [layout, setLayoutState] = useState<CaptureLayoutExperiment>(
    CAPTURE_LAYOUT_DEFAULT,
  );

  useEffect(() => {
    try {
      setLayoutState(
        parseCaptureLayout(
          window.localStorage.getItem(CAPTURE_LAYOUT_STORAGE_KEY),
        ),
      );
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const setLayout = useCallback((next: CaptureLayoutExperiment) => {
    setLayoutState(next);
    try {
      window.localStorage.setItem(CAPTURE_LAYOUT_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return { layout, setLayout };
}
