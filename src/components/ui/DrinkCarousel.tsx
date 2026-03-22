import { drinkImages, drinkImagesExtra } from '../../data/images';

const allPhotos = [...drinkImages, ...drinkImagesExtra];

export default function DrinkCarousel() {
  const photos = [...allPhotos, ...allPhotos];

  return (
    <div className="relative overflow-hidden py-8 -mt-4">
      {/* Fade edges */}
      <div className="absolute inset-y-0 left-0 w-20 z-10 bg-gradient-to-r from-background to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-20 z-10 bg-gradient-to-l from-background to-transparent pointer-events-none" />

      {/* Scrolling track */}
      <div className="carousel-track flex gap-4 hover:[animation-play-state:paused]">
        {photos.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className="shrink-0 w-56 md:w-72 lg:w-80 aspect-[4/5] rounded-2xl overflow-hidden group"
          >
            <img
              src={src}
              alt={`Crafted cocktail ${(i % allPhotos.length) + 1}`}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              loading="lazy"
            />
          </div>
        ))}
      </div>

      {/* Mobile swipe hint */}
      <p className="text-center text-text-dim text-xs mt-3 md:hidden">
        Swipe to explore our drinks
      </p>
    </div>
  );
}
