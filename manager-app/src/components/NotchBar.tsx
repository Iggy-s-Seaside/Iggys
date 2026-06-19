import { useEffect, useState } from 'react';

/**
 * Read env(safe-area-inset-top) in pixels. JS can't read the env() variable
 * directly, so we measure a hidden probe element whose height is driven by it.
 */
function readTopInset(): number {
  if (typeof document === 'undefined') return 0;
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;height:env(safe-area-inset-top,0px)';
  document.body.appendChild(probe);
  const h = probe.getBoundingClientRect().height;
  probe.remove();
  return h;
}

/**
 * NotchBar — a branded "seaside tide" flourish that fills the top safe-area band
 * (the strip behind the status bar / around the notch) on installed iPhones.
 *
 * Because the app runs standalone with a black-translucent status bar, content
 * renders UNDER the notch and the OS draws the white clock/battery over this band.
 * A dark base keeps that text legible; on top of it a subtle teal tide drifts, a
 * glowing "waterline" sits at the bottom edge, and a one-shot sweep plays whenever
 * the app is opened or brought back to the foreground ("the tide coming in").
 *
 * Renders nothing when there's no top inset (no notch / desktop), so it costs zero
 * idle animation off-device. pointer-events:none — never intercepts taps. Motion is
 * disabled by the global prefers-reduced-motion rule (leaves a static dark band).
 *
 * Mounted once, app-wide, from main.tsx.
 */
export function NotchBar() {
  const [inset, setInset] = useState(0);
  // Bumping this remounts the sweep layer, restarting its one-shot animation.
  const [sweepKey, setSweepKey] = useState(0);

  useEffect(() => {
    const measure = () => setInset(readTopInset());
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    // Replay the "tide coming in" each time the PWA returns to the foreground.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') setSweepKey((k) => k + 1);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // No notch / no inset → nothing to render (and no idle animation cost).
  if (inset <= 0) return null;

  return (
    <div className="notch-bar" aria-hidden="true" style={{ height: 'env(safe-area-inset-top, 0px)' }}>
      <div className="notch-tide" />
      <div key={sweepKey} className="notch-sweep" />
      <div className="notch-line" />
    </div>
  );
}

export default NotchBar;
