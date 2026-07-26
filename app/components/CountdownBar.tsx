"use client";

import type { MouseEvent } from "react";

export const EXPERIMENT_DURATION_MS = 90 * 1000;

export function formatRemainingTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
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
    <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-[480px] items-center gap-2 px-3 py-2.5 text-[13px] md:max-w-[640px]">
        <div className="min-w-0 flex-1 tabular-nums text-neutral-700">
          剩余时间 {countdownLabel}
        </div>
        <div className="shrink-0 text-neutral-600">
          已转发 {shareCount}/{maxShares}
        </div>
        <div className="shrink-0">
          <button
            type="button"
            disabled={!canEnd}
            onClick={onEndClick}
            className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
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
