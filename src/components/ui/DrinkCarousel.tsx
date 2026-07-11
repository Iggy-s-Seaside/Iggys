import { useEffect, useRef, useState } from 'react';
import { cocktailCards } from '../../data/images';

export default function DrinkCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const check = () => setHasOverflow(track.scrollWidth > track.clientWidth + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  const scrollByTile = (dir: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const tile = track.querySelector<HTMLElement>('[data-tile]');
    const step = tile ? tile.offsetWidth + 20 : 340;
    track.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  return (
    <div className="relative py-8 -mt-4">
      {/* Fade edges (desktop) */}
      <div className="hidden md:block absolute inset-y-0 left-0 w-12 z-10 bg-gradient-to-r from-background to-transparent pointer-events-none" />
      <div className="hidden md:block absolute inset-y-0 right-0 w-12 z-10 bg-gradient-to-l from-background to-transparent pointer-events-none" />

      {/* Desktop arrows */}
      <button
        type="button"
        aria-label="Previous drink"
        onClick={() => scrollByTile(-1)}
        className={`${hasOverflow ? 'hidden md:flex' : 'hidden'} absolute left-4 top-1/2 -translate-y-1/2 z-20 h-11 w-11 items-center justify-center rounded-full border border-glass-border bg-black/40 text-white/70 backdrop-blur-md transition-all duration-300 hover:bg-black/60 hover:text-white`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Next drink"
        onClick={() => scrollByTile(1)}
        className={`${hasOverflow ? 'hidden md:flex' : 'hidden'} absolute right-4 top-1/2 -translate-y-1/2 z-20 h-11 w-11 items-center justify-center rounded-full border border-glass-border bg-black/40 text-white/70 backdrop-blur-md transition-all duration-300 hover:bg-black/60 hover:text-white`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>

      {/* Snap-scroll strip */}
      <div
        ref={trackRef}
        className="scrollbar-hide flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 scroll-px-6 md:px-16 md:scroll-px-16 md:[justify-content:safe_center]"
      >
        {cocktailCards.map(({ src, name }) => (
          <figure key={src} data-tile className="group w-[76vw] max-w-[300px] shrink-0 snap-center md:snap-start">
            <div className="aspect-[4/5] overflow-hidden rounded-2xl border border-glass-border/50 shadow-lg shadow-black/40 transition-all duration-300 ease-out group-hover:scale-[1.02] group-hover:shadow-2xl group-hover:shadow-black/60">
              <img
                src={src}
                alt={`${name} at Iggy's`}
                width={880}
                height={1100}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <figcaption className="mt-3 text-center font-heading text-sm tracking-wide text-text-muted">
              {name}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
