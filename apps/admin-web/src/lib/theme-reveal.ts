/**
 * Changes the page's look (theme color, light or dark) with a circle of the
 * new look growing from `origin`, using the View Transitions API. Browsers
 * without it, and people who ask their device for less motion, get the change
 * at once.
 */
export function revealChange(origin: Element | null, change: () => void) {
  if (
    !origin ||
    typeof document.startViewTransition !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    change();
    return;
  }

  const rect = origin.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  // Far enough to cover the corner furthest from the origin.
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  const root = document.documentElement;
  // Turns off the default cross-fade for this transition (globals.css).
  root.classList.add("theme-reveal");
  const transition = document.startViewTransition(change);
  transition.ready
    .then(() => {
      root.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 750,
          easing: "cubic-bezier(0.65, 0, 0.35, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {
      // Skipped (say, the tab was hidden): the change still applied.
    });
  const cleanUp = () => root.classList.remove("theme-reveal");
  transition.finished.then(cleanUp, cleanUp);
}
