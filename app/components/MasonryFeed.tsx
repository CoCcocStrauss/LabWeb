"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { assignMasonryColumns } from "../lib/readingProtocol";
function columnCount() {
  if (
    typeof window === "undefined" ||
    !window.matchMedia(
      "(min-width:1024px) and (hover:hover) and (pointer:fine)",
    ).matches
  )
    return 2;
  return window.innerWidth >= 1440 ? 4 : 3;
}
export function MasonryFeed({
  items,
  onLayout,
}: {
  items: { id: string; node: ReactNode }[];
  onLayout?: (columns: number, assignments: Record<string, number>) => void;
}) {
  const [columns, setColumns] = useState(columnCount),
    [assignment, setAssignment] = useState<Record<string, number>>({});
  const grid = useRef<HTMLDivElement>(null),
    nodes = useRef(new Map<string, HTMLDivElement>()),
    latest = useRef({ items, onLayout });
  latest.current = { items, onLayout };
  const key = items.map((i) => i.id).join("|");
  useLayoutEffect(() => {
    let frame = 0;
    const calculate = () => {
      const current = latest.current.items;
      const heights = current.map(
        (i) => nodes.current.get(i.id)?.getBoundingClientRect().height ?? 0,
      );
      if (heights.some((h) => h <= 0)) return;
      const gap = grid.current
        ? parseFloat(getComputedStyle(grid.current).columnGap) || 10
        : 10;
      const placements = assignMasonryColumns(heights, columns, gap);
      const next = Object.fromEntries(
        current.map((i, index) => [i.id, placements[index]]),
      );
      setAssignment((old) =>
        current.every((i) => old[i.id] === next[i.id]) ? old : next,
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(calculate);
    };
    const resize = () => {
      setColumns(columnCount());
      schedule();
    };
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(schedule);
    nodes.current.forEach((n) => observer?.observe(n));
    if (grid.current) observer?.observe(grid.current);
    calculate();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [columns, key]);
  useLayoutEffect(() => {
    if (
      latest.current.items.every(
        (i) => assignment[i.id] !== undefined && assignment[i.id] < columns,
      )
    )
      latest.current.onLayout?.(columns, assignment);
  }, [assignment, columns, key]);
  return (
    <div
      ref={grid}
      className="feed-grid"
      aria-label="瀑布流内容"
      style={{ gridTemplateColumns: `repeat(${columns},minmax(0,1fr))` }}
    >
      {Array.from({ length: columns }, (_, column) => (
        <div className="feed-column" key={column}>
          {items
            .filter((i, index) => {
              const saved = assignment[i.id];
              // A narrower viewport must still render cards from removed columns
              // so their heights can be measured for the new placement.
              return (
                (saved !== undefined && saved < columns
                  ? saved
                  : index % columns) === column
              );
            })
            .map((item) => (
              <div
                key={item.id}
                ref={(node) => {
                  if (node) nodes.current.set(item.id, node);
                  else nodes.current.delete(item.id);
                }}
              >
                {item.node}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
