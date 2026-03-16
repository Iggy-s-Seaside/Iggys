import { useEffect, useRef, useState, useCallback } from 'react';

// Shared single IntersectionObserver for all scroll animations
const observerCallbacks = new Map<Element, () => void>();
let sharedObserver: IntersectionObserver | null = null;

function getSharedObserver() {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cb = observerCallbacks.get(entry.target);
            if (cb) {
              cb();
              observerCallbacks.delete(entry.target);
              sharedObserver?.unobserve(entry.target);
            }
          }
        });
      },
      { threshold: 0.1 }
    );
  }
  return sharedObserver;
}

export function useScrollAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = getSharedObserver();
    observerCallbacks.set(el, () => setIsVisible(true));
    observer.observe(el);

    return () => {
      observerCallbacks.delete(el);
      observer.unobserve(el);
    };
  }, []);

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
