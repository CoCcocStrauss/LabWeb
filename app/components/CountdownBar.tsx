"use client";

import type { MouseEvent } from "react";
import { READING_DURATION_MS } from "../lib/experimentSession";

export const EXPERIMENT_DURATION_MS = READING_DURATION_MS;

export function formatRemainingTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type CountdownBarProps = {
  remainingMs: number;
  shareCount: number;
  maxShares?: number;
  isMounted: boolean;
  isRunning: boolean;
  onEndClick: (e: MouseEvent<HTMLButtonElement>) => void;
};

export function CountdownBar({
  remainingMs,
  shareCount,
  maxShares = 2,
  isMounted,
  isRunning,
  onEndClick,
}: CountdownBarProps) {
  const countdownLabel = formatRemainingTime(remainingMs);
  const canEnd = isMounted && shareCount >= maxShares && isRunning;

  return (
    <footer className="study-footer study-pad z-30 border-t border-neutral-200 bg-white">
      <div className="study-status">
        <div className="study-status-details">
          <span className="tabular-nums text-neutral-700">剩余时间 {countdownLabel}</span>
          <span className="text-neutral-600">已转发 {shareCount}/{maxShares}</span>
        </div>
        <div className="shrink-0">
          <button
            type="button"
            disabled={!canEnd}
            onClick={onEndClick}
            className={`study-control whitespace-nowrap rounded-full px-4 py-2 font-medium transition-colors ${
              canEnd
                ? "bg-[#0084ff] text-white active:bg-[#0073e6]"
                : "cursor-not-allowed bg-neutral-200 text-neutral-400"
            }`}
          >
            结束实验
          </button>
        </div>
      </div>
    </footer>
  );
}
