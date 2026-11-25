"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Item = { id: string; expanded: boolean; node: ReactNode; pinned?: boolean; expandedOrder?: number };
type Box = { left: number; top: number; width: number; height: number };
function columnCount() {
  return typeof window !== "undefined" &&
    window.matchMedia("(min-width:1024px) and (hover:hover) and (pointer:fine)").matches
    ? 4 : 2;
}

/** Each pair stays in its original half; a half never sizes or packs its sibling. */
export function DualZoneFeed({ items, onLayout }: {
  items: Item[];
  initialLayout?: unknown;
  onLayout?: (columns: number, assignments: Record<string, number>, spans: Record<string, number>) => void;
}) {
  const [columns, setColumns] = useState(columnCount);
  const grid = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const prior = useRef<{ columns: number; width: number; boxes: Map<string, Box> }>();
  const animations = useRef(new Map<string, Animation>());
  const latest = useRef({ items, onLayout });
  latest.current = { items, onLayout };
  const key = items.map((item) => item.id + ":" + Number(item.expanded)).join("|");
  useLayoutEffect(() => {
    let frame = 0, settle: ReturnType<typeof setTimeout> | undefined;
    const activeAnimations = animations.current;
    const measure = (animate = false) => {
      const root = grid.current;
      if (!root) return;
      const assignments: Record<string, number> = {}, spans: Record<string, number> = {};
      const boxes = new Map<string, Box>();
      const canAnimate = animate && prior.current?.columns === columns &&
        prior.current.width === root.clientWidth &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      for (const item of latest.current.items) {
        const node = nodes.current.get(item.id), pair = node?.parentElement;
        const half = pair?.parentElement;
        if (!node || !pair || !half) return;
        const gap = parseFloat(getComputedStyle(pair).columnGap) || 10;
        const localColumn = Math.round(node.offsetLeft / ((pair.clientWidth + gap) / 2));
        assignments[item.id] = Number(half.dataset.zoneIndex) * 2 + localColumn;
        spans[item.id] = item.expanded ? 2 : 1;
        const box = { left: half.offsetLeft + pair.offsetLeft + node.offsetLeft,
          top: half.offsetTop + pair.offsetTop + node.offsetTop,
          width: node.offsetWidth, height: node.offsetHeight };
        boxes.set(item.id, box);
      }
      // Notify against final layout BEFORE FLIP transforms. Scroll pinning runs
      // synchronously in this layout effect, rather than after the 230ms animation.
      if (animate || !animations.current.size) latest.current.onLayout?.(columns, assignments, spans);
      for (const item of latest.current.items) {
        const node = nodes.current.get(item.id)!, box = boxes.get(item.id)!;
        const old = prior.current?.boxes.get(item.id);
        if (canAnimate && old && (old.left !== box.left || old.top !== box.top || old.width !== box.width || old.height !== box.height)) {
          animations.current.get(item.id)?.cancel();
          const animation = node.animate([
            { transform: `translate(${old.left - box.left}px, ${item.pinned ? 0 : old.top - box.top}px) scale(${old.width / box.width}, ${old.height / box.height})` },
            { transform: "none" },
          ], { duration: 230, easing: "cubic-bezier(.2,.7,.2,1)" });
          animations.current.set(item.id, animation);
          animation.onfinish = () => { animations.current.delete(item.id); schedule(); };
        }
      }
      prior.current = { columns, width: root.clientWidth, boxes };
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => measure()); };
    const resize = () => { setColumns(columnCount()); schedule(); };
    const observer = new ResizeObserver(schedule);
    if (grid.current) observer.observe(grid.current);
    nodes.current.forEach((node) => observer.observe(node));
    measure(true);
    // Re-measure settled, untransformed geometry for exposure and scroll anchoring.
    settle = setTimeout(() => measure(), 250);
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame); clearTimeout(settle);
      activeAnimations.forEach((animation) => { animation.onfinish = null; animation.cancel(); });
      activeAnimations.clear();
      window.removeEventListener("resize", resize);
    };
  }, [columns, key]);
  const zones = columns === 4
    ? [items.filter((_, index) => Math.floor(index / 2) % 2 === 0), items.filter((_, index) => Math.floor(index / 2) % 2 === 1)]
    : [items];
  return (
    <div ref={grid} className="dual-zone-feed" data-columns={columns} aria-label="阅读内容">
      {zones.map((zone, zoneIndex) => (
        <div className="dual-zone-half" data-zone-index={zoneIndex} key={zoneIndex}>
          {Array.from({ length: Math.ceil(zone.length / 2) }, (_, pairIndex) => {
            const pair = zone.slice(pairIndex * 2, pairIndex * 2 + 2);
            // If both are open, keep the earlier expansion first; neither closes.
            const leader = pair.filter((item) => item.expanded)
              .sort((a, b) => (a.expandedOrder ?? 0) - (b.expandedOrder ?? 0))[0];
            return <div className="dual-zone-pair" data-pair-index={pairIndex} key={pair[0].id}>
            {pair.map((item) => <div key={item.id} className="dual-zone-item" data-zone={zoneIndex}
              data-column-span={item.expanded ? 2 : 1} data-post-key={item.id}
              style={{ gridColumn: item.expanded ? "span 2" : undefined, order: item === leader ? -1 : 0 }}
              ref={(node) => { if (node) nodes.current.set(item.id, node); else nodes.current.delete(item.id); }}>
              {item.node}
            </div>)}
            </div>;
          })}
        </div>
      ))}
    </div>
  );
}
