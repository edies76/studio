'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BrandMark from '@/components/brand-mark';
import { cn } from '@/lib/utils';

type AnimatedBrandProps = {
  className?: string;
  href?: string;
  scrollRoot?: string;
  size?: number;
};

export default function AnimatedBrand({
  className,
  href = '/',
  scrollRoot,
  size = 28,
}: AnimatedBrandProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const root = scrollRoot ? document.querySelector<HTMLElement>(scrollRoot) : null;
    const target = root ?? window;
    const getPosition = () => root?.scrollTop ?? window.scrollY;
    let previous = getPosition();

    const onScroll = () => {
      const current = getPosition();
      if (current <= 10) setExpanded(false);
      else if (current > previous + 4) setExpanded(true);
      else if (current < previous - 4) setExpanded(false);
      previous = current;
    };

    target.addEventListener('scroll', onScroll, { passive: true });
    return () => target.removeEventListener('scroll', onScroll);
  }, [scrollRoot]);

  return (
    <Link href={href} className={cn('animated-brand', expanded && 'is-expanded', className)} aria-label="Docs Studio home">
      <BrandMark size={size} />
      <span className="animated-brand__word">Docs<span className="animated-brand__studio" aria-hidden={!expanded}> Studio</span></span>
    </Link>
  );
}
