// Frozen v2 protocol: preserve existing sessions and scoring.
"use client";
export function ReadyPage({ onStart }: { onStart: () => void }) {
  return <main className="study-shell study-page flex flex-col">
    <h1 className="study-title">准备开始阅读</h1>
    <p className="study-copy mt-5">接下来，你将阅读围绕一个话题发布的内容。</p>
    <ul className="study-copy mt-5 list-disc space-y-3 pl-5">
      <li>阅读时间为 90 秒。</li>
      <li>请尽量阅读页面中的内容，并选择你最认同的两条进行转发。</li>
      <li>选满两条后，可以继续阅读，也可以手动结束。</li>
      <li>时间结束后，阅读将自动结束，并进入后续问题。</li>
    </ul>
    <p className="study-copy mt-8 text-neutral-600">点击下方按钮后开始计时。</p>
    <button type="button" onClick={onStart} className="study-control mt-4 w-full rounded-full bg-[#0084ff] px-4 py-3 font-medium text-white active:bg-[#0073e6]">开始阅读</button>
  </main>;
}
