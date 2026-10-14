import { useEffect, type RefObject } from "react";

export function EmbedBridge({
  enabled,
  root,
}: {
  enabled: boolean;
  root: RefObject<HTMLDivElement | null>;
}) {
  useEffect(() => {
    if (!enabled || !root.current || window.parent === window) return;
    const element = root.current;
    let previous = 0;
    let frame = 0;
    let parentOrigin = "*";
    try {
      parentOrigin = new URL(document.referrer).origin;
    } catch {
      /* A página pode ocultar o referrer. */
    }
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = Math.ceil(element.getBoundingClientRect().height);
        if (height === previous || height < 100) return;
        previous = height;
        window.parent.postMessage({ type: "escaninho:crossword:resize", height }, parentOrigin);
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [enabled, root]);
  return null;
}
