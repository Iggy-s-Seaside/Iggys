import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import SectionHeader from '../layout/SectionHeader';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';

/**
 * High Tide Saturdays feature: the hype reel (muted autoplay, plays only while
 * on screen — battery/bandwidth friendly) + a strip of real Saturday-night
 * photos from upstairs. Assets live in /videos and /images/events/gallery.
 */

const GALLERY = [
  { src: '/images/events/gallery/dance-floor.jpg', alt: "Packed dance floor upstairs at Iggy's — lasers and neon" },
  { src: '/images/events/gallery/dj-decks.jpg', alt: 'DJ on the decks under the string lights' },
  { src: '/images/events/gallery/slay-bar.jpg', alt: 'Back bar glowing pink and blue under the Slay neon' },
  { src: '/images/events/gallery/neon-fireworks.jpg', alt: 'Neon light columns and fireworks in the sunset sky' },
  { src: '/images/events/gallery/taps-dusk.jpg', alt: 'Beer taps against the dusk sky on the upstairs deck' },
  { src: '/images/events/gallery/night-party.jpg', alt: 'Saturday night crowd dancing upstairs' },
];

function HypeVideo() {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);

  // Play while visible, pause off-screen.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
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
    <div className="relative glass-card overflow-hidden rounded-2xl">
      <video
        ref={ref}
        className="w-full aspect-video object-cover"
        src="/videos/high-tide-hype.mp4"
        poster="/videos/high-tide-hype-poster.jpg"
        muted={muted}
        loop
        playsInline
        preload="metadata"
      />
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? 'Unmute video' : 'Mute video'}
        className="absolute bottom-4 right-4 w-11 h-11 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
      >
        {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>
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
          all night — every Saturday, all summer, never a cover. This is what
          it looks like.
        </p>

        <div className="mt-8">
          <HypeVideo />
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
