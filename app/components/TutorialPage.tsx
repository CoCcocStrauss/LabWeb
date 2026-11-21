"use client";
import { useCallback, useState } from "react";
import { RULES, type RulesResponse } from "../lib/readingProtocol";
import { CompactPostCard } from "./CompactPostCard";
import { PostDetail } from "./PostDetail";
import type { PostCardData } from "./PostCard";
const demos: PostCardData[] = [
  {
    id: "demo-a",
    displayName: "示例用户A",
    sourceLevel: "high",
    avatarFile: "v7.jpg",
    identityLabel: "户外活动分享者",
    platformLabel: "示例认证",
    content: "周末去公园散步很舒服。树荫多的地方走起来没那么晒。",
  },
  {
    id: "demo-b",
    displayName: "示例用户B",
    sourceLevel: "low",
    content: "我更喜欢在家看书；安静的时候能慢慢看。",
  },
];
export function TutorialPage({
  response,
  onChange,
  onStart,
}: {
  response: RulesResponse;
  onChange: (r: RulesResponse) => void;
  onStart: () => void;
}) {
  const [liked, setLiked] = useState<Record<string, boolean>>({}),
    [shared, setShared] = useState<Record<string, boolean>>({}),
    [opened, setOpened] = useState<string | null>(null);
  const close = useCallback(() => setOpened(null), []);
  const actions = (id: string) => ({
    onLike: () => setLiked((v) => ({ ...v, [id]: !v[id] })),
    onShare: () => setShared((v) => ({ ...v, [id]: true })),
  });
  return (
    <div className="study-shell study-screen tutorial-screen">
      <main className="study-scroll study-pad py-5">
        <h1 className="study-title">任务说明</h1>
        <div className="demo-grid mt-4">
          {demos.map((p) => (
            <CompactPostCard
              key={p.id}
              post={p}
              liked={!!liked[p.id]}
              shared={!!shared[p.id]}
              shareDisabled={!!shared[p.id]}
              onOpen={() => setOpened(String(p.id))}
              {...actions(String(p.id))}
            />
          ))}
        </div>
        <div className="mt-5 space-y-3">
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
        <button
          type="button"
          disabled={!response.items.every((i) => i.checked)}
          onClick={onStart}
          className="study-control w-full rounded-full bg-[#0084ff] px-4 py-3 text-white disabled:bg-neutral-200 disabled:text-neutral-400"
        >
          下一步
        </button>
      </footer>
      {opened ? (
        <PostDetail
          post={demos.find((p) => p.id === opened)!}
          liked={!!liked[opened]}
          shared={!!shared[opened]}
          disabled={false}
          shareDisabled={!!shared[opened]}
          onClose={close}
          {...actions(opened)}
        />
      ) : null}
    </div>
  );
}
