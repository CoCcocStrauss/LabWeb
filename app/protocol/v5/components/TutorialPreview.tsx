"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CompactPostCard } from "../../../components/CompactPostCard";
import { pinCardToViewport } from "../../../lib/scrollPinning";
import { DualZoneFeed } from "../../../components/DualZoneFeed";
import type { RulesResponse } from "../lib/readingProtocol";
import { TUTORIAL_POSTS } from "../data/tutorial";
import { ReadingStatus } from "./ReadingStatus";

// Only the original certified example needs a persisted label selection.
// Extra neutral cards are low-source, with no randomly assigned labels.
const POSTS = [
  TUTORIAL_POSTS[0],
  { id: "practice-b", displayName: "示例用户B", sourceLevel: "low" as const,
    content: "周末在家读书也很放松。找一本感兴趣的书，留一段不被打扰的时间，慢慢看就好。" },
  { id: "practice-c", displayName: "示例用户C", sourceLevel: "low" as const,
    content: "我喜欢在天气好的时候整理阳台。给植物浇水，再把椅子挪到窗边，坐一会儿也很舒服。" },
  { id: "practice-d", displayName: "示例用户D", sourceLevel: "low" as const,
    content: "和朋友一起做顿饭是不错的周末安排。大家分头准备食材，边做边聊，过程也很有意思。" },
  { id: "practice-e", displayName: "示例用户E", sourceLevel: "low" as const,
    content: "我常带着相机在附近走走。熟悉的小路在不同的天气里也有不一样的风景，随手记录下来很有意思。" },
  { id: "practice-f", displayName: "示例用户F", sourceLevel: "low" as const,
    content: "整理房间后心情会轻松一些。把常用的东西放在顺手的位置，下次找起来就方便了。" },
  { id: "practice-g", displayName: "示例用户G", sourceLevel: "low" as const,
    content: "有空的时候我会听一张完整的专辑。不急着换歌，听到后面常常会发现之前没留意的旋律。" },
  { id: "practice-h", displayName: "示例用户H", sourceLevel: "low" as const,
    content: "附近的小菜市场值得逛一逛。看看当季的水果，和摊主聊两句，再决定今天晚饭做什么。" },
];

export function TutorialPreview({ stepIndex, selections }: {
  stepIndex: number;
  selections: RulesResponse["demoLabelSelections"];
}) {
  const [replay, setReplay] = useState(0);
  const [running, setRunning] = useState(stepIndex < 2);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [shared, setShared] = useState<string[]>([]);
  const [liked, setLiked] = useState<string[]>([]);
  const [remaining, setRemaining] = useState(150000);
  const [cursor, setCursor] = useState({ x: 16, y: 24, visible: false, ripple: 0 });
  const root = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ id: string; top: number } | null>(null);
  const [read, setRead] = useState<string[]>([]);
  const toggleExpanded = (id: string) => {
    const card = root.current?.querySelector(`[data-post-id="${id}"]`);
    if (card) anchor.current = { id, top: card.getBoundingClientRect().top };
    setRead((ids) => [...new Set([...ids, ...expanded])]);
    setExpanded((ids) => ids.includes(id) ? [] : [id]);
  };
  const toggle = (ids: string[], id: string) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

  useLayoutEffect(() => {
    const demo = root.current, scroller = demo?.closest<HTMLElement>(".study-scroll");
    if (!demo || !scroller) return;
    const fit = () => {
      const status = demo.querySelector<HTMLElement>(".reading-status");
      const caption = demo.parentElement?.querySelector<HTMLElement>(".tutorial-demo-caption");
      const available = scroller.getBoundingClientRect().bottom - demo.getBoundingClientRect().top - scroller.scrollTop -
        (status?.offsetHeight ?? 0) - (caption?.offsetHeight ?? 40) - 10;
      demo.style.setProperty("--tutorial-preview-max-height", `${Math.max(180, Math.min(440, available))}px`);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(scroller);
    const status = demo.querySelector(".reading-status");
    if (status) observer.observe(status);
    fit(); window.addEventListener("resize", fit);
    return () => { observer.disconnect(); window.removeEventListener("resize", fit); };
  }, []);

  useEffect(() => {
    if (stepIndex !== 2) return;
    const start = performance.now();
    const timer = setInterval(() => setRemaining(150000 - Math.min(10000, (performance.now() - start) % 11000)), 100);
    return () => clearInterval(timer);
  }, [stepIndex]);

  useEffect(() => {
    if (stepIndex === 2) return;
    setRunning(true);
    setExpanded([]);
    setShared([]);
    setLiked([]);
    setRead([]);
    if (viewport.current) viewport.current.scrollTop = 0;
    setCursor({ x: 16, y: 24, visible: true, ripple: 0 });
    const target = () => root.current?.querySelector<HTMLElement>(
      stepIndex === 1
        ? '.feed-card > .feed-actions button:last-child'
        : '.feed-card > .feed-content-button, .feed-card > .feed-content',
    );
    const move = () => {
      const el = target(), box = root.current?.getBoundingClientRect();
      if (!el || !box) return;
      const rect = el.getBoundingClientRect();
      setCursor((old) => ({ ...old,
        x: rect.left - box.left + (stepIndex === 1 ? rect.width / 2 : Math.min(60, rect.width / 2)),
        y: rect.top - box.top + Math.min(20, rect.height / 2),
      }));
    };
    const tap = () => {
      move();
      setCursor((old) => ({ ...old, ripple: old.ripple + 1 }));
      target()?.click();
    };
    // A single round: move, tap, allow 1.2s of full-text reading, tap, fade.
    const timers = [
      setTimeout(move, 180),
      setTimeout(tap, 850),
      setTimeout(move, 2050),
      setTimeout(tap, 2300),
      setTimeout(() => setCursor((old) => ({ ...old, visible: false })), 2700),
      setTimeout(() => setRunning(false), 3000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [stepIndex, replay]);

  return (
    <section className="tutorial-practice" aria-label="真实阅读页练习">
      <div className="tutorial-demo" ref={root} data-demo-step={`step_${stepIndex + 1}`} data-manual={!running}
        aria-busy={running}
        onClickCapture={(event) => {
          if (running && event.nativeEvent.isTrusted) { event.preventDefault(); event.stopPropagation(); }
        }}
        onKeyDownCapture={(event) => {
          if (running && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); event.stopPropagation(); }
        }}>
        {stepIndex < 2 ? <button className="tutorial-replay" type="button" disabled={running} onClick={() => setReplay((v) => v + 1)}>重播演示</button> : null}
        <ReadingStatus title="周末生活分享" remainingMs={remaining} shares={shared.length} annotate={stepIndex === 2} />
        <div ref={viewport} className="tutorial-preview-feed reading-feed" tabIndex={0} aria-label="示例卡片练习区">
          <DualZoneFeed
            onLayout={() => {
              const saved = anchor.current, scroller = viewport.current;
              if (!saved || !scroller) return;
              const card = root.current?.querySelector(`[data-post-id="${saved.id}"]`);
              if (card) pinCardToViewport(card as HTMLElement, saved.top, scroller);
              anchor.current = null;
            }}
            items={POSTS.map((original) => {
              const id = String(original.id), post = { ...original, ...selections?.[id] };
              return { id, pinned: anchor.current?.id === id, expanded: expanded.includes(id), node:
                <CompactPostCard post={post} expanded={expanded.includes(id)} read={read.includes(id)}
                  liked={liked.includes(id)} shared={shared.includes(id)} shareDisabled={false}
                  onOpen={() => toggleExpanded(id)} onCollapse={() => toggleExpanded(id)}
                  onLike={() => setLiked((ids) => toggle(ids, id))}
                  onShare={() => setShared((ids) => toggle(ids, id))} /> };
            })} />
        </div>
        {stepIndex < 2 ? <div className={`tutorial-cursor${cursor.visible ? " is-visible" : ""}`} aria-hidden="true"
          style={{ left: cursor.x, top: cursor.y }}>
          {cursor.ripple > 0 ? <span key={cursor.ripple} className="tutorial-click-ripple" /> : null}
          <svg width="32" height="38" viewBox="0 0 32 38" fill="none">
            <path d="M3 2L27 22L16 24L11 34L3 2Z" fill="#0084ff" stroke="white" strokeWidth="2.5" strokeLinejoin="round" />
          </svg>
        </div> : null}
      </div>
      <div className="tutorial-demo-caption">
        <span role="status">{running ? "蓝色光标正在演示" : "现在你可以自由点击卡片试试看"}</span>
      </div>
    </section>
  );
}
