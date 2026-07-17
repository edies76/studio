/** Cascade / waterfall animation when injecting HTML into the paper */

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

/** Progressive paint while streaming: only animate newly completed top-level blocks */
export function paintStreamingHtml(el: HTMLDivElement, html: string): void {
  const prevCount = el.children.length;
  el.innerHTML = html;
  const kids = Array.from(el.children) as HTMLElement[];
  // Soft-land only new blocks so stream feels alive without thrashing
  kids.forEach((child, i) => {
    if (i < prevCount) return;
    child.classList.add('studio-cascade-item');
    child.style.animationDelay = '0ms';
    window.setTimeout(() => {
      child.classList.remove('studio-cascade-item');
      child.style.animationDelay = '';
    }, 380);
  });
}
