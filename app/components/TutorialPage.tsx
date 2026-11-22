"use client";
import { useRef, useState, type ReactNode } from "react";
import { RULES, type RulesResponse } from "../lib/readingProtocol";
import { SpanningMasonryFeed } from "./SpanningMasonryFeed";
import { CompactPostCard } from "./CompactPostCard";
import { TUTORIAL_POSTS } from "../data/tutorial";
export function TutorialPage({
  response,
  onChange,
  onStart,
  canContinue = true,
  saveStatus,
}: {
  response: RulesResponse;
  onChange: (r: RulesResponse) => void;
  onStart: () => void;
  canContinue?: boolean;
  saveStatus?: ReactNode;
}) {
  const [liked, setLiked] = useState<Record<string, boolean>>({}),
    [shared, setShared] = useState<Record<string, boolean>>({}),
    [opened, setOpened] = useState<string[]>([]);
  const scroller = useRef<HTMLElement>(null),
    anchor = useRef<{ id: string; offset: number } | null>(null);
  const toggle = (id: string, expanded: boolean) => {
    const root = scroller.current,
      card = root?.querySelector(`[data-post-id="${id}"]`);
    if (root && card)
      anchor.current = {
        id,
        offset: Math.max(
          0,
          card.getBoundingClientRect().top - root.getBoundingClientRect().top,
        ),
      };
    setOpened((v) => (expanded ? [...v, id] : v.filter((item) => item !== id)));
  };
  const demos = TUTORIAL_POSTS.map((p) => ({
    ...p,
    ...response.demoLabelSelections?.[String(p.id)],
  }));
  const actions = (id: string) => ({
    onLike: () => setLiked((v) => ({ ...v, [id]: !v[id] })),
    onShare: () => setShared((v) => ({ ...v, [id]: true })),
  });
  return (
    <div className="study-shell study-screen tutorial-screen">
      <main ref={scroller} className="study-scroll study-pad py-5">
        <h1 className="study-title">任务说明</h1>
        <div className="demo-grid-wrap mt-4">
          <SpanningMasonryFeed
            onLayout={() => {
              const root = scroller.current,
                saved = anchor.current;
              if (!root || !saved) return;
              const card = root.querySelector(`[data-post-id="${saved.id}"]`);
              if (card)
                root.scrollTop +=
                  card.getBoundingClientRect().top -
                  root.getBoundingClientRect().top -
                  saved.offset;
              anchor.current = null;
            }}
            items={demos.map((p) => ({
              id: String(p.id),
              expanded: opened.includes(String(p.id)),
              node: (
                <CompactPostCard
                  post={p}
                  liked={!!liked[p.id]}
                  shared={!!shared[p.id]}
                  shareDisabled={!!shared[p.id]}
                  expanded={opened.includes(String(p.id))}
                  onOpen={() => toggle(String(p.id), true)}
                  onCollapse={() => toggle(String(p.id), false)}
                  {...actions(String(p.id))}
                />
              ),
            }))}
          />
        </div>
        <p className="study-copy tutorial-check-intro mt-6">
          请逐条阅读并勾选。每次勾选表示你已明白并理解该条规则；全部确认后即可继续。
        </p>
        <div className="mt-4 space-y-3">
          {RULES.map(([id, text], i) => (
            <label
              key={id}
              className="study-control flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 p-3"
            >
              <input
                type="checkbox"
                checked={response.items[i].checked}
                className="mt-1 h-5 w-5 shrink-0 accent-[#0084ff]"
                onChange={(e) =>
                  onChange({
                    ...response,
                    items: response.items.map((item) =>
                      item.id === id
                        ? {
                            ...item,
                            checked: e.target.checked,
                            changedAt: Date.now(),
                          }
                        : item,
                    ),
                  })
                }
              />
              <span>{text}</span>
            </label>
          ))}
        </div>
      </main>
      <footer className="study-footer study-pad border-t border-neutral-200">
        {saveStatus}
        <button
          type="button"
          disabled={!canContinue || !response.items.every((i) => i.checked)}
          onClick={onStart}
          className="study-control w-full rounded-full bg-[#0084ff] px-4 py-3 text-white disabled:bg-neutral-200 disabled:text-neutral-400"
        >
          下一步
        </button>
      </footer>
    </div>
  );
}
