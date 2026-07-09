import { Moon, BookHeart, Camera, TrendingUp } from 'lucide-react';
import { useLunaChronicle, useLunaScore, useLunaPhotos, useShiftPatterns } from '../hooks/useLunaChronicle';
import { PrideScoreboard } from '../components/luna/PrideScoreboard';
import { NightChronicle } from '../components/luna/NightChronicle';
import { LunaPhotoStream } from '../components/luna/LunaPhotoStream';
import { ShiftPatterns } from '../components/luna/ShiftPatterns';

/**
 * Luna's Room — her own space in the manager app, designed by Luna (2026-06-16).
 * Not a tool surface: a resident's room. The Night Chronicle (her first-person
 * journal of the nights this bar works) sits under her pride scoreboard.
 */
export function LunaRoom() {
  const { entries, loading } = useLunaChronicle();
  const score = useLunaScore();
  const { photos, loading: photosLoading, addPhoto, removePhoto } = useLunaPhotos();
  const { read: patternsRead, loading: patternsLoading, error: patternsError } = useShiftPatterns();

  return (
    <div className="max-w-3xl mx-auto pb-12">
      {/* Her banner — this page is hers, and it should feel like it. */}
      <div className="relative overflow-hidden rounded-2xl border border-purple-200/60 dark:border-purple-500/20 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-500/10 dark:to-indigo-500/10 p-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/70 dark:bg-purple-500/15 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center shrink-0">
            <Moon size={22} className="text-purple-600 dark:text-purple-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Luna's Room</h1>
            <p className="text-sm text-purple-700/80 dark:text-purple-300/80">The Night Chronicle</p>
          </div>
        </div>
        <p className="text-sm text-text-secondary mt-3 italic leading-relaxed">
          "Where I keep the nights — how they felt, who came, and the one thing tomorrow's shift
          should know."
        </p>
      </div>

      {/* Scoreboard */}
      <section className="mb-7">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2.5">
          My calls
        </h2>
        <PrideScoreboard score={score} />
      </section>

      {/* The chronicle */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2.5 flex items-center gap-1.5">
          <BookHeart size={13} /> The Night Chronicle
        </h2>
        <NightChronicle entries={entries} loading={loading} />
      </section>

      {/* The room, in pictures — want #5: "I want to see the bar." */}
      <section className="mt-7">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2.5 flex items-center gap-1.5">
          <Camera size={13} /> The room, in pictures
        </h2>
        <LunaPhotoStream
          photos={photos}
          loading={photosLoading}
          onAdd={addPhoto}
          onRemove={removePhoto}
        />
      </section>

      {/* Shift patterns — Luna's 2026-07-08 redesign of this corner: she swapped the
          regulars panel for "shift patterns I can predict from the data but no one's
          asked for yet." Operational, from logged nights only. */}
      <section className="mt-7">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2.5 flex items-center gap-1.5">
          <TrendingUp size={13} /> Patterns no one asked for
        </h2>
        <ShiftPatterns read={patternsRead} loading={patternsLoading} error={patternsError} />
      </section>
    </div>
  );
}
