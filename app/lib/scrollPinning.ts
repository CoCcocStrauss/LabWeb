/** Run before paint, against the actual scroll owner (the study uses a fixed shell). */
export function pinCardToViewport(card: HTMLElement, previousTop: number, scroller?: HTMLElement | null) {
  const delta = card.getBoundingClientRect().top - previousTop;
  if (Math.abs(delta) > 4) {
    if (scroller) scroller.scrollBy({ top: delta, behavior: "instant" });
    else window.scrollBy({ top: delta, behavior: "instant" });
  }
}
