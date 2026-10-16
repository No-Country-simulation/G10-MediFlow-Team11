export const BACK_TO_TOP_SCROLL_THRESHOLD = 320;

export function shouldShowBackToTop(scrollPosition: number): boolean {
  return scrollPosition > BACK_TO_TOP_SCROLL_THRESHOLD;
}

export function scrollHelpPageToTop(reducedMotion: boolean): void {
  window.scrollTo({
    top: 0,
    behavior: reducedMotion ? "auto" : "smooth",
  });
}
