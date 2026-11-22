export type MasonryBox = {
  column: number;
  span: number;
  top: number;
  height: number;
};
type FreeRectangle = MasonryBox;
const EPS = 0.01;
const right = (r: MasonryBox) => r.column + r.span;
const bottom = (r: MasonryBox) => r.top + r.height;
const intersects = (a: MasonryBox, b: MasonryBox) =>
  a.column < right(b) &&
  right(a) > b.column &&
  a.top < bottom(b) - EPS &&
  bottom(a) > b.top + EPS;
const contains = (a: MasonryBox, b: MasonryBox) =>
  a.column <= b.column &&
  right(a) >= right(b) &&
  a.top <= b.top + EPS &&
  bottom(a) >= bottom(b) - EPS;

/** Keep maximal empty rectangles, including finite holes above later cards. */
function consume(
  rectangles: FreeRectangle[],
  used: MasonryBox,
): FreeRectangle[] {
  const next: FreeRectangle[] = [];
  for (const r of rectangles) {
    if (!intersects(r, used)) {
      next.push(r);
      continue;
    }
    if (used.top > r.top + EPS) next.push({ ...r, height: used.top - r.top });
    if (bottom(used) < bottom(r) - EPS)
      next.push({ ...r, top: bottom(used), height: bottom(r) - bottom(used) });
    if (used.column > r.column)
      next.push({ ...r, span: used.column - r.column });
    if (right(used) < right(r))
      next.push({ ...r, column: right(used), span: right(r) - right(used) });
  }
  return next.filter(
    (r, i) =>
      r.span > 0 &&
      r.height > EPS &&
      !next.some(
        (other, j) =>
          i !== j && contains(other, r) && (!contains(r, other) || j < i),
      ),
  );
}

/** Process the original material sequence; fill the topmost fitting rectangle. */
export function placeSpanningCards(
  collapsedHeights: number[],
  heights: number[],
  expanded: boolean[],
  columns: number,
  gap: number,
  previous?: MasonryBox[],
): MasonryBox[] {
  const preferredBottoms = Array(columns).fill(0) as number[];
  const preferred = collapsedHeights.map((height) => {
    const column = preferredBottoms.indexOf(Math.min(...preferredBottoms));
    preferredBottoms[column] += height + gap;
    return column;
  });
  let free: FreeRectangle[] = [
    { column: 0, span: columns, top: 0, height: Infinity },
  ];
  return heights.map((height, index) => {
    const span = expanded[index] ? 2 : 1,
      preferredColumn = previous?.[index]?.column ?? preferred[index];
    let best: MasonryBox | undefined;
    for (const rectangle of free) {
      if (rectangle.span < span || rectangle.height + EPS < height + gap)
        continue;
      for (
        let column = rectangle.column;
        column + span <= right(rectangle);
        column++
      ) {
        const candidate = { column, span, top: rectangle.top, height };
        if (
          !best ||
          candidate.top < best.top - EPS ||
          (Math.abs(candidate.top - best.top) < EPS &&
            (Math.abs(column - preferredColumn) <
              Math.abs(best.column - preferredColumn) ||
              (Math.abs(column - preferredColumn) ===
                Math.abs(best.column - preferredColumn) &&
                column < best.column)))
        )
          best = candidate;
      }
    }
    if (!best) throw new Error("No fitting masonry rectangle");
    free = consume(free, { ...best, height: height + gap });
    // On phones a full-width card is a row boundary: subsequent cards follow it.
    if (columns === 2 && span === 2) {
      const floor = best.top + height + gap;
      free = free
        .map((r) =>
          r.top >= floor ? r : { ...r, top: floor, height: bottom(r) - floor },
        )
        .filter((r) => r.height > EPS);
    }
    return best;
  });
}
