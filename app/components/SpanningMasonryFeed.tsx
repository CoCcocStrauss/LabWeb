"use client";
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { placeSpanningCards, type MasonryBox } from "../lib/spanningMasonry";
function columnCount() {
  return typeof window !== "undefined" &&
    window.matchMedia("(min-width:1024px) and (hover:hover) and (pointer:fine)")
      .matches
    ? window.innerWidth >= 1440
      ? 4
      : 3
    : 2;
}
export function SpanningMasonryFeed({
  items,
  onLayout,
  initialLayout,
}: {
  items: { id: string; expanded: boolean; node: ReactNode }[];
  initialLayout?: {
    columns: number;
    viewportWidth: number;
    assignments: Record<string, number>;
  };
  onLayout?: (
    columns: number,
    assignments: Record<string, number>,
    spans: Record<string, number>,
  ) => void;
}) {
  const [columns, setColumns] = useState(columnCount),
    [layout, setLayout] = useState<{
      width: number;
      gap: number;
      boxes: MasonryBox[];
    }>({ width: 0, gap: 10, boxes: [] });
  const previous = useRef<MasonryBox[] | undefined>(
    initialLayout?.columns === columnCount()
      ? items.map((item) => ({
          column: initialLayout.assignments[item.id] ?? 0,
          span: item.expanded ? 2 : 1,
          top: 0,
          height: 0,
        }))
      : undefined,
  );
  const grid = useRef<HTMLDivElement>(null),
    nodes = useRef(new Map<string, HTMLDivElement>()),
    latest = useRef({ items, onLayout });
  latest.current = { items, onLayout };
  const key = items.map((x) => x.id + ":" + Number(x.expanded)).join("|");
  useLayoutEffect(() => {
    let frame = 0;
    const calculate = () => {
      if (!grid.current) return;
      const width = grid.current.clientWidth,
        gap = parseFloat(getComputedStyle(grid.current).columnGap) || 10,
        current = latest.current.items;
      grid.current.style.setProperty(
        "--feed-column-width",
        `${(width - gap * (columns - 1)) / columns}px`,
      );
      const heights = current.map(
          (i) => nodes.current.get(i.id)?.getBoundingClientRect().height ?? 0,
        ),
        collapsed = current.map((i, index) =>
          i.expanded
            ? (nodes.current
                .get(i.id)
                ?.querySelector(".feed-card-sizing")
                ?.getBoundingClientRect().height ?? heights[index])
            : heights[index],
        );
      if (
        !width ||
        heights.some((h) => h <= 0) ||
        collapsed.some((h) => h <= 0)
      )
        return;
      const boxes = placeSpanningCards(
        collapsed,
        heights,
        current.map((i) => i.expanded),
        columns,
        gap,
        previous.current,
      );
      previous.current = boxes;
      setLayout((old) =>
        old.width === width &&
        old.gap === gap &&
        JSON.stringify(old.boxes) === JSON.stringify(boxes)
          ? old
          : { width, gap, boxes },
      );
    };
    const schedule = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(calculate);
      },
      resize = () => {
        setColumns(columnCount());
        schedule();
      };
    const observer = new ResizeObserver(schedule);
    if (grid.current) observer.observe(grid.current);
    nodes.current.forEach((n) => observer.observe(n));
    calculate();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [columns, key]);
  useLayoutEffect(() => {
    if (
      layout.boxes.length === items.length &&
      layout.width === grid.current?.clientWidth &&
      items.every(
        (item, i) =>
          layout.boxes[i].span === (item.expanded ? 2 : 1) &&
          layout.boxes[i].column + layout.boxes[i].span <= columns,
      )
    )
      latest.current.onLayout?.(
        columns,
        Object.fromEntries(items.map((x, i) => [x.id, layout.boxes[i].column])),
        Object.fromEntries(items.map((x, i) => [x.id, layout.boxes[i].span])),
      );
  }, [layout, columns, items]);
  const unit = layout.width
    ? (layout.width - layout.gap * (columns - 1)) / columns
    : 0;
  return (
    <div
      ref={grid}
      className="spanning-feed"
      aria-label="瀑布流内容"
      data-columns={columns}
      style={
        {
          height: Math.max(0, ...layout.boxes.map((b) => b.top + b.height)),
          "--feed-column-width": `${unit}px`,
        } as CSSProperties
      }
    >
      {items.map((item, index) => {
        const box = layout.boxes[index],
          span = item.expanded ? 2 : 1;
        return (
          <div
            key={item.id}
            className="spanning-feed-item"
            data-column={box?.column ?? index % columns}
            data-column-span={span}
            ref={(n) => {
              if (n) nodes.current.set(item.id, n);
              else nodes.current.delete(item.id);
            }}
            style={{
              width: `calc((100% - ${(columns - 1) * layout.gap}px) / ${columns} * ${span} + ${(span - 1) * layout.gap}px)`,
              left: box && unit ? box.column * (unit + layout.gap) : 0,
              top: box?.top ?? 0,
            }}
          >
            {item.node}
          </div>
        );
      })}
    </div>
  );
}
