"use client";
import { useEffect } from "react";
import type { PostItem } from "../../../lib/blockRandomize";
import { chooseComparison, finishComparison, type BestWorstComparison } from "../lib/bestWorstComparison";

export function BestWorstPage({ response: c, posts, onChange, onContinue }: {
  response: BestWorstComparison;
  posts: Map<string, PostItem>;
  onChange: (c: BestWorstComparison) => void;
  onContinue: (c: BestWorstComparison) => void;
}) {
  useEffect(() => { if (c.presentedAt === null) onChange({ ...c, presentedAt: Date.now() }); }, [c, onChange]);
  return <div className="study-shell study-screen comparison-screen">
    <header className="study-header study-pad border-b">
      <h1 className="study-title">观点对比</h1>
      <p className="study-copy mt-2">在下面这组讨论内容中，请分别选出 1 条「最符合你的想法」和 1 条「最不符合你的想法」：</p>
    </header>
    <main className="study-scroll study-pad comparison-grid">
      {c.candidateIds.map((id, index) => <article className="comparison-card" key={id}>
        <h2 className="study-meta font-medium">内容 {String.fromCharCode(65 + index)}</h2>
        <p className="study-copy whitespace-pre-wrap">{posts.get(id)!.content}</p>
        <div className="comparison-choices">
          {([['mostAlignedPostId', '最符合我的想法'], ['leastAlignedPostId', '最不符合我的想法']] as const).map(([field, text]) =>
            <button key={field} type="button" aria-pressed={c[field] === id} className={c[field] === id ? 'is-chosen' : ''}
              onClick={() => onChange(chooseComparison(c, field, id))}>{text}</button>)}
        </div>
      </article>)}
    </main>
    <footer className="study-footer study-pad border-t">
      <button className="study-control w-full rounded-full bg-[#0084ff] px-4 py-3 text-white disabled:bg-neutral-200 disabled:text-neutral-400"
        disabled={!c.mostAlignedPostId || !c.leastAlignedPostId || c.mostAlignedPostId === c.leastAlignedPostId || c.presentedAt === null}
        onClick={() => onContinue(finishComparison(c))}>继续</button>
    </footer>
  </div>;
}
