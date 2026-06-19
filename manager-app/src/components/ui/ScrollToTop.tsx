import { useEffect, useState, type RefObject } from 'react';
import { ArrowUp } from 'lucide-react';
import { buzz } from '../../utils/haptics';

/**
 * Mobile "scroll to top" affordance. The app shell scrolls inside ONE inner
 * container on mobile (not the window), so this watches that element's scrollTop
 * and fades in a thumb-reachable button once the manager is a screenful or two
 * down a long list. Tapping smooth-scrolls back to the top. Hidden on desktop
 * (lg+) where the page uses normal body scroll + the full sidebar.
 */
export function ScrollToTop({ scrollRef }: { scrollRef: RefObject<HTMLElement | null> }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setShow(el.scrollTop > 600);
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollRef]);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={() => {
        buzz(8);
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      aria-label="Scroll to top"
      className="lg:hidden fixed right-3 bottom-[calc(6.75rem+env(safe-area-inset-bottom,0px))] z-40 inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface border border-border text-text-secondary shadow-card hover:bg-surface-hover hover:text-text-primary active:scale-95 transition-all animate-fade-in focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <ArrowUp size={20} aria-hidden="true" />
    </button>
  );
}

export default ScrollToTop;
