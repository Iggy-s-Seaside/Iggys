import PageHeader from '../components/layout/PageHeader';
import SectionHeader from '../components/layout/SectionHeader';
import { images } from '../data/images';
import { Martini, Leaf, Flame } from 'lucide-react';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

const stats = [
  { value: '1983', label: "Dooger's Est." },
  { value: '2023', label: "Iggy's Founded" },
  { value: '7 Days', label: 'A Week' },
  { value: '40+', label: 'Years of Family' },
];

const vibes = [
  {
    icon: Martini,
    title: 'Indoor Bar',
    description:
      'Full bar with TVs for sports, lottery, and good company. Cozy and comfortable rain or shine.',
    image: images.wallInside,
  },
  {
    icon: Leaf,
    title: 'Covered Upstairs Patio',
    description:
      'An outdoor covered patio upstairs with fresh air, cold drinks, and a view of downtown Seaside.',
    image: images.tapOutside,
  },
  {
    icon: Flame,
    title: 'Fire Pit',
    description:
      'Hang out around the fire pit right outside on the ground floor. Dogs welcome, always.',
    image: images.nightOutside,
  },
];

function VibeCard({ vibe }: { vibe: (typeof vibes)[number] }) {
  const { ref, isVisible } = useScrollAnimation();
  return (
    <div
      ref={ref}
      className={`group relative overflow-hidden rounded-2xl ${
        isVisible ? 'animate-fade-in-up' : 'opacity-0 translate-y-6'
      }`}
    >
      <div className="aspect-[4/3] overflow-hidden">
        <img
          src={vibe.image}
          alt={vibe.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/10" />
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <vibe.icon className="w-7 h-7 text-primary" aria-hidden="true" />
        <h3 className="font-heading text-xl font-semibold text-white mt-2">
          {vibe.title}
        </h3>
        <p className="text-white/70 text-sm mt-1">{vibe.description}</p>
      </div>
    </div>
  );
}

export default function About() {
  return (
    <>
      <PageHeader
        eyebrow="Our Story"
        title="About Iggy's"
        subtitle="A family legacy on the Oregon Coast"
      />

      {/* Story section — Owner's original words */}
      <section className="section-padding">
        <div className="section-container">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <SectionHeader
                align="left"
                eyebrow="The Beginning"
                title="Four decades of family"
              />
              <p className="text-text-muted mt-6 leading-relaxed text-lg">
                In 1983, Mary Weise saw potential in a property in downtown
                Seaside. She invited her son, Dooger, to join her in starting a
                restaurant, and they embarked on a culinary adventure together.
                With Dooger as the head chef and Mary as the skilled prep cook,
                they transformed their establishment, Dooger's Seafood and
                Grill, into a beloved seaside institution over four decades.
              </p>
              <p className="text-text-muted mt-4 leading-relaxed text-lg">
                In 2011, Carnegie Wiese, Dooger's son, returned to help run the
                family business. When the COVID-19 pandemic hit, Carnegie turned
                the parking lot into an outdoor dining oasis with picnic tables
                and a firepit, ensuring Dooger's survival. Recognizing the
                opportunity for permanent transformation, Carnegie consulted his
                college friend, Vito Surreli, to design an innovative
                indoor-outdoor bar that captures the essence of the coast. Their
                vision includes welcoming dogs and a fresh, artistically infused
                modern ambiance that brings a unique charm to Seaside.
              </p>
            </div>

            {/* Right image */}
            <div className="relative">
              <div className="rounded-2xl overflow-hidden shadow-2xl shadow-primary/10">
                <img
                  src={images.iggysFamily}
                  alt="The Iggy's crew"
                  className="w-full object-cover"
                />
              </div>
              <div className="absolute bottom-4 left-4 glass-card p-4 hidden md:block backdrop-blur-md bg-black/45">
                <p className="text-primary font-heading text-lg font-bold">
                  Est. 1983
                </p>
                <p className="text-text-muted text-xs">
                  A family legacy in Seaside
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats section */}
      <section className="py-16 bg-surface/30">
        <div className="section-container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="glass-card p-6 text-center">
                <p className="font-heading text-4xl font-bold gradient-text">
                  {stat.value}
                </p>
                <p className="text-text-muted text-sm mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Experience section — image cards with overlay */}
      <section className="section-padding">
        <div className="section-container">
          <SectionHeader
            eyebrow="What Makes Us Special"
            title="The Iggy's Experience"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
            {vibes.map((vibe) => (
              <VibeCard key={vibe.title} vibe={vibe} />
            ))}
          </div>
        </div>
      </section>

      {/* Gallery section */}
      <section className="py-16 bg-surface/30">
        <div className="section-container">
          <SectionHeader eyebrow="Gallery" title="Life at Iggy's" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-10">
            {[
              images.wallInside2,
              images.mural,
              images.jellyFish,
              images.barTop,
              images.slayClose,
              images.djNight,
              images.wineCrab,
              images.nightOutside,
            ].map((src, i) => (
              <div
                key={i}
                className="aspect-square overflow-hidden rounded-xl group"
              >
                <img
                  src={src}
                  alt={`Iggy's gallery ${i + 1}`}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
