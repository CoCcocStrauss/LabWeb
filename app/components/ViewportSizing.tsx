"use client";

import { useEffect } from "react";

/** iOS键盘、移动浏览器地址栏变化时，让操作栏保持在实际可见区域内。 */
export function ViewportSizing() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // 放大时保留布局尺寸，允许浏览器正常缩放与平移。
        if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
        const height = viewport?.height ?? window.innerHeight;
        root.style.setProperty("--study-height", `${height}px`);
        root.style.setProperty("--study-top", `${viewport?.offsetTop ?? 0}px`);
        root.toggleAttribute("data-study-compact", height <= 480);
      });
    };
    update();
    window.addEventListener("resize", update);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      root.style.removeProperty("--study-height");
      root.style.removeProperty("--study-top");
      root.removeAttribute("data-study-compact");
    };
  }, []);
  return null;
}
