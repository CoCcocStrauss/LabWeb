"use client";

export default function ErrorPage() {
  return <main className="study-shell study-page flex flex-col items-center justify-center text-center">
    <h1 className="study-title">页面暂时未能加载</h1>
    <p className="study-copy mt-5 text-neutral-700">请刷新页面继续，已保存的实验进度会恢复。若仍无法打开，请联系实验员。</p>
    <button type="button" onClick={() => window.location.reload()} className="study-control mt-6 rounded-full bg-[#0084ff] px-8 py-3 text-white">刷新并继续</button>
  </main>;
}
