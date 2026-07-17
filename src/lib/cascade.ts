/** Animations when injecting HTML into the paper */

/** First-document reveal: full HTML is in the DOM, hidden; vertical shine sweeps top→bottom and reveals with opacity */
export function applyFirstDraftReveal(
  el: HTMLDivElement,
  html: string,
  onDone?: () => void,
): void {
  el.innerHTML = html;
  el.classList.remove('studio-first-reveal', 'studio-cascade-host');
  // force reflow so animation restarts
  void el.offsetHeight;
  el.classList.add('studio-first-reveal');

  // Scan line sibling (full page width of the paper column)
  const host = el.parentElement;
  let scan: HTMLDivElement | null = null;
  if (host) {
    host.querySelectorAll('.studio-reveal-scan').forEach((n) => n.remove());
    scan = document.createElement('div');
    scan.className = 'studio-reveal-scan';
    scan.setAttribute('aria-hidden', 'true');
    // match editor width/position
    scan.style.width = `${el.offsetWidth}px`;
    scan.style.left = `${el.offsetLeft}px`;
    host.appendChild(scan);
  }

  const DURATION = 2200;
  window.setTimeout(() => {
    el.classList.remove('studio-first-reveal');
    scan?.remove();
    onDone?.();
  }, DURATION);
}

/** Stagger cascade (secondary; block-by-block) */
export function applyHtmlWithCascade(
  el: HTMLDivElement,
  html: string,
  onDone?: () => void,
): void {
  el.innerHTML = html;
  const kids = Array.from(el.children) as HTMLElement[];
  if (!kids.length) {
    onDone?.();
    return;
  }

  kids.forEach((child, i) => {
    child.classList.add('studio-cascade-item');
    child.style.setProperty('--cascade-i', String(i));
    child.style.animationDelay = `${Math.min(i * 48, 900)}ms`;
  });

  const total = Math.min(kids.length * 48, 900) + 420;
  window.setTimeout(() => {
    kids.forEach((c) => {
      c.classList.remove('studio-cascade-item');
      c.style.animationDelay = '';
      c.style.removeProperty('--cascade-i');
    });
    onDone?.();
  }, total);
}

/** Progressive paint while streaming live tokens (real deltas only) */
export function paintStreamingHtml(el: HTMLDivElement, html: string): void {
  el.innerHTML = html;
}
