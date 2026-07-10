import { useEffect, useRef } from 'react';
import SectionHeader from '../layout/SectionHeader';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';

/**
 * High Tide Saturdays feature: a silent 16s seamless ambient loop (plays only
 * while on screen; static poster for prefers-reduced-motion) + real Saturday-
 * night photos from upstairs. Assets in /videos and /images/events/gallery.
 */

const GALLERY = [
  { src: '/images/events/gallery/dance-floor.jpg', alt: "Packed dance floor upstairs at Iggy's — lasers and neon" },
  { src: '/images/events/gallery/dj-decks.jpg', alt: 'DJ on the decks under the string lights' },
  { src: '/images/events/gallery/slay-bar.jpg', alt: 'Back bar glowing pink and blue under the Slay neon' },
  { src: '/images/events/gallery/neon-fireworks.jpg', alt: 'Neon light columns and fireworks in the sunset sky' },
  { src: '/images/events/gallery/upstairs-deck.jpg', alt: 'The upstairs deck at night — string lights on and the floor filling up' },
  { src: '/images/events/gallery/seaside-sunset.jpg', alt: 'Sunset over the Pacific, two blocks from the bar' },
];

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function AmbientLoop() {
  const ref = useRef<HTMLVideoElement | null>(null);

  // Play while visible, pause off-screen; never autoplay for reduced-motion users.
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia(REDUCED_MOTION).matches) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="glass-card overflow-hidden rounded-2xl">
      <video
        ref={ref}
        className="w-full aspect-video object-cover"
        src="/videos/high-tide-loop.mp4"
        poster="/videos/high-tide-loop-poster.jpg"
        muted
        loop
        playsInline
        preload="metadata"
        aria-label="Slow-motion scenes from Saturday nights upstairs: fireworks over town and the dance floor"
      />
    </div>
  );
}

export default function SaturdayNightsSection() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section className="section-padding bg-surface/30">
      <div className="section-container">
        <SectionHeader
          eyebrow="High Tide Saturdays"
          title="Saturday nights upstairs"
        />
        <p className="text-text-muted mt-4 max-w-2xl">
          Rotating DJs from the Hit Squad, full bar upstairs, dance floor open
          all night — every Saturday, all summer, never a cover.
        </p>

        <div className="mt-8">
          <AmbientLoop />
        </div>

        <div
          ref={ref}
          className={`mt-6 grid grid-cols-2 md:grid-cols-3 gap-4 ${
            isVisible ? 'animate-fade-in-up' : 'opacity-0 translate-y-6'
          }`}
        >
          {GALLERY.map((photo) => (
            <img
              key={photo.src}
              src={photo.src}
              alt={photo.alt}
              loading="lazy"
              decoding="async"
              className="w-full h-44 md:h-56 object-cover rounded-xl border border-white/5"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
