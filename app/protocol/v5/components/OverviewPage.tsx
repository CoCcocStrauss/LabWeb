"use client";
import type { ReactNode } from "react";

const STEPS = [
  ["浏览并转发帖子", "浏览关于刚才话题的讨论帖子，至少转发 2 条你最认同的内容（未满 2 条无法完成浏览任务）。"],
  ["完成简短问答", "浏览结束后回答几个简短问题并说明你的想法，认真作答可获得额外奖励。"],
];
export function OverviewPage({ canContinue, saveStatus, onContinue }: {
  canContinue: boolean;
  saveStatus?: ReactNode;
  onContinue: () => void;
}) {
  return <div className="study-shell study-screen overview-screen">
    <header className="study-header study-pad border-b"><h1 className="study-title">接下来的实验流程</h1></header>
    <main className="study-scroll study-pad py-4">
      <p className="study-copy">正式实验模拟类似小红书的浏览页面，包含两部分：</p>
      <ol className="overview-steps">
        {STEPS.map(([title, text], index) => <li className="overview-step" key={title}>
          <div className="overview-step-heading"><span className="overview-step-number">{index + 1}</span><h2 className="study-copy font-semibold">{title}</h2></div>
          <p className="study-copy mt-3">{text}</p>
        </li>)}
      </ol>
    </main>
    <footer className="study-footer study-pad border-t">
      {saveStatus}
      <p className="study-meta mb-3">正式开始前，先通过操作教程熟悉页面操作。</p>
      <button type="button" disabled={!canContinue} onClick={onContinue}
        className="study-control w-full rounded-full bg-[#0084ff] px-4 py-3 text-white disabled:bg-neutral-200 disabled:text-neutral-400">开始操作教程</button>
    </footer>
  </div>;
}
