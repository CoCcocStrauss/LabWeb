"use client";

import type { MouseEvent } from "react";

export type ShareModalProps = {
  open: boolean;
  onConfirm: (e: MouseEvent<HTMLButtonElement>) => void;
  onCancel: (e: MouseEvent<HTMLButtonElement>) => void;
};

export function ShareModal({ open, onConfirm, onCancel }: ShareModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div
        className="w-4/5 max-w-sm rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          id="share-modal-title"
          className="mb-6 text-center text-lg font-medium text-gray-800"
        >
          是否确认转发？
        </p>
        <div className="flex w-full gap-3">
          <button
            type="button"
            className="flex-1 rounded-lg border border-gray-300 bg-gray-50 py-2.5 text-sm font-medium text-gray-800 active:bg-gray-100"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            type="button"
            className="flex-1 rounded-lg bg-[#0084ff] py-2.5 text-sm font-medium text-white active:bg-[#0073e6]"
            onClick={onConfirm}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}
