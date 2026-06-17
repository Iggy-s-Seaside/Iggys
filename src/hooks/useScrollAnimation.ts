import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Reveal-on-scroll hook. Returns a callback `ref` + an `isVisible` flag; callers
 * fade/slide their content in when `isVisible` flips true.
 *
 * Why a CALLBACK ref and not useRef + useEffect: the homepage Events & Specials
 * preview (and any section gated on async Supabase data) does NOT exist in the DOM
 * on first mount — it renders only after the data arrives. A `useEffect(() => {...},
 * [])` runs once at mount, sees `ref.current === null`, bails, and never re-runs when
 * the section later appears, so its content stays stuck at opacity-0: a full-height
 * empty band on the page. React invokes a callback ref exactly when the node attaches
 * (including async/conditional mounts) and again with null when it detaches, so the
 * reveal wiring is set up the moment the element really exists.
 *
 * Once attached, a section can never stay invisible:
 *   (a) reveals immediately if it's already in — or scrolled past — the viewport;
 *   (b) reveals as it scrolls into view via passive scroll/resize listeners that read
 *       getBoundingClientRect directly (no IntersectionObserver to miss the callback);
 *   (c) a 3s safety-net timer reveals it no matter what.
 */
export function useScrollAnimation() {
  const [isVisible, setIsVisible] = useState(false);
  const doneRef = useRef(false);
  const teardownRef = useRef<(() => void) | null>(null);

  const ref = useCallback((el: HTMLDivElement | null) => {
    // Detach previous wiring (node swapped out or replaced).
    if (teardownRef.current) {
      teardownRef.current();
      teardownRef.current = null;
    }
    if (!el || doneRef.current) return;

    let raf = 0;
    let timer = 0;

    const teardown = () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
      teardownRef.current = null;
    };

    const reveal = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      setIsVisible(true);
      teardown();
    };

    const inView = () => {
      const r = el.getBoundingClientRect();
      // Already scrolled past, OR any part within ~92% of the viewport height.
      return r.bottom <= 0 || (r.top < window.innerHeight * 0.92 && r.bottom > 0);
    };

    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (inView()) reveal();
      });
    };

    // (a) in / above the viewport the moment it attaches — show now.
    if (inView()) {
      reveal();
      return;
    }

    // (b) reveal as it enters the viewport — direct, observer-free.
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    // (c) safety net: a section can NEVER remain an empty band.
    timer = window.setTimeout(reveal, 3000);

    teardownRef.current = teardown;
  }, []);

  // Tear down listeners if the owning component unmounts before revealing.
  useEffect(() => () => teardownRef.current?.(), []);

  return { ref, isVisible };
}

export function useScrollPosition() {
  const [scrollY, setScrollY] = useState(0);
  const ticking = useRef(false);

  const handleScroll = useCallback(() => {
    if (!ticking.current) {
      ticking.current = true;
      requestAnimationFrame(() => {
        setScrollY(window.scrollY);
        ticking.current = false;
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return scrollY;
}
