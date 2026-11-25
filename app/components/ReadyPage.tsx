"use client";
export function ReadyPage({ onStart, durationSeconds = 90 }: { onStart: () => void; durationSeconds?: number }) {
  return (
    <main className="study-shell study-page flex flex-col items-center justify-center text-center">
      <h1 className="study-title">准备开始</h1>
      <p className="study-copy mt-4 text-neutral-600">
        点击下方按钮后开始 {durationSeconds} 秒阅读。
      </p>
      <button
        type="button"
        onClick={onStart}
        className="study-control mt-6 rounded-full bg-[#0084ff] px-8 py-3 text-white"
      >
        开始实验
      </button>
    </main>
  );
}
