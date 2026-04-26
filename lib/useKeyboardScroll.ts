import { useEffect } from "react";

export function useKeyboardScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    function scrollFocusedIntoView() {
      const keyboardHeight = Math.max(0, window.innerHeight - (vv?.height ?? window.innerHeight));
      document.documentElement.style.setProperty("--keyboard-height", `${keyboardHeight}px`);
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    }

    vv.addEventListener("resize", scrollFocusedIntoView);
    document.addEventListener("focusin", scrollFocusedIntoView);

    return () => {
      vv.removeEventListener("resize", scrollFocusedIntoView);
      document.removeEventListener("focusin", scrollFocusedIntoView);
    };
  }, []);
}
