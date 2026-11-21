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
      className="study-screen z-50 items-center justify-center overflow-y-auto bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div
        className="my-auto w-full max-w-md shrink-0 rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          id="share-modal-title"
          className="study-title mb-6 text-center text-gray-800"
        >
          是否确认转发？
        </p>
        <div className="flex w-full gap-3">
          <button
            type="button"
            className="study-control flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-3 font-medium text-gray-800 active:bg-gray-100"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            type="button"
            className="study-control flex-1 rounded-lg bg-[#0084ff] px-3 py-3 font-medium text-white active:bg-[#0073e6]"
            onClick={onConfirm}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}
