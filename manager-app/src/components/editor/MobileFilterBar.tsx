import { useState, memo } from 'react';
import { X, RotateCcw, Palette } from 'lucide-react';
import type { ImageFilters } from '../../types';
import { FILTER_PRESETS } from '../../types';
import { SLIDER_CONFIG, OVERLAY_COLORS } from './editorConstants';
import type { ActiveSlider } from './editorConstants';

interface MobileFilterBarProps {
  filters: ImageFilters;
  hasBackground: boolean;
  onUpdate: (filters: Partial<ImageFilters>) => void;
  onReset: () => void;
  onClose: () => void;
}

export const MobileFilterBar = memo(function MobileFilterBar({
  filters,
  hasBackground,
  onUpdate,
  onReset,
  onClose,
}: MobileFilterBarProps) {
  const [activeSlider, setActiveSlider] = useState<ActiveSlider>(null);

  if (!hasBackground) {
    return (
      <div
        className="fixed top-12 left-0 right-0 z-[65] md:hidden safe-area-top"
        style={{ animation: 'slideDownIn 250ms cubic-bezier(0.32, 0.72, 0, 1)' }}
      >
        <div className="mx-3 mt-2 rounded-2xl bg-surface/95 backdrop-blur-xl border border-border/20 shadow-modal p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-text-primary">Filters</span>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-surface-hover active:scale-90 transition-all">
              <X size={16} className="text-text-muted" />
            </button>
          </div>
          <p className="text-xs text-text-muted">Upload a background image to use filters</p>
        </div>
      </div>
    );
  }

  const activeConfig = activeSlider
    ? SLIDER_CONFIG.find(s => s.id === activeSlider)
    : null;

  return (
    <div
      className="fixed top-12 left-0 right-0 z-[65] md:hidden safe-area-top"
      style={{ animation: 'slideDownIn 250ms cubic-bezier(0.32, 0.72, 0, 1)' }}
    >
      <div className="mx-3 mt-2 rounded-2xl bg-surface/95 backdrop-blur-xl border border-border/20 shadow-modal overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-1">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider flex-1">Filters</span>
          <button
            onClick={onReset}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-text-muted hover:text-primary active:scale-95 transition-all"
          >
            <RotateCcw size={10} /> Reset
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-surface-hover active:scale-90 transition-all"
          >
            <X size={16} className="text-text-muted" />
          </button>
        </div>

        {/* Filter preset pills — horizontally scrollable */}
        <div
          className="flex gap-1.5 px-3 py-2 overflow-x-auto scrollbar-hide"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {FILTER_PRESETS.map((preset) => {
            const isActive = filters.preset === preset.id || (preset.id === 'none' && !filters.preset);
            return (
              <button
                key={preset.id}
                onClick={() => {
                  onUpdate(preset.filters);
                  setActiveSlider(null);
                }}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-surface-hover text-text-secondary hover:bg-surface-active'
                }`}
              >
                {preset.name}
              </button>
            );
          })}
        </div>

        {/* Fine-tune adjustment pills */}
        <div className="flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
          {SLIDER_CONFIG.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveSlider(activeSlider === id ? null : id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all active:scale-95 ${
                activeSlider === id
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-surface-hover/60 text-text-muted border border-transparent'
              }`}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
          <button
            onClick={() => setActiveSlider(activeSlider === 'overlay' ? null : 'overlay')}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all active:scale-95 ${
              activeSlider === 'overlay'
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'bg-surface-hover/60 text-text-muted border border-transparent'
            }`}
          >
            <Palette size={12} /> Overlay
          </button>
        </div>

        {/* Active slider area — appears when a fine-tune pill is tapped */}
        {activeConfig && (
          <div
            className="px-4 pb-3 pt-1 border-t border-border/20"
            style={{ animation: 'fadeSlideUp 150ms ease-out' }}
          >
            <div className="flex items-center gap-3">
              <activeConfig.icon size={14} className="text-text-muted shrink-0" />
              <input
                type="range"
                min={activeConfig.min}
                max={activeConfig.max}
                value={filters[activeConfig.key] as number}
                onChange={(e) => onUpdate({ [activeConfig.key]: Number(e.target.value), preset: null })}
                className="flex-1 accent-primary h-2"
              />
              <span className="text-xs font-medium text-text-secondary tabular-nums w-8 text-right">
                {Math.round(filters[activeConfig.key] as number)}
              </span>
            </div>
          </div>
        )}

        {/* Overlay controls */}
        {activeSlider === 'overlay' && (
          <div
            className="px-4 pb-3 pt-1 border-t border-border/20"
            style={{ animation: 'fadeSlideUp 150ms ease-out' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <input
                type="color"
                value={filters.overlayColor}
                onChange={(e) => onUpdate({ overlayColor: e.target.value, preset: null })}
                className="w-7 h-7 rounded-lg cursor-pointer border border-border shrink-0"
              />
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(filters.overlayOpacity * 100)}
                onChange={(e) => onUpdate({ overlayOpacity: Number(e.target.value) / 100, preset: null })}
                className="flex-1 accent-primary h-2"
              />
              <span className="text-xs font-medium text-text-secondary tabular-nums w-8 text-right">
                {Math.round(filters.overlayOpacity * 100)}%
              </span>
            </div>
            <div className="flex gap-1.5">
              {OVERLAY_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => onUpdate({ overlayColor: c, overlayOpacity: Math.max(filters.overlayOpacity, 0.2), preset: null })}
                  className={`w-7 h-7 rounded-full border-2 transition-all active:scale-90 ${
                    filters.overlayColor === c ? 'border-primary scale-110' : 'border-border/50'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

MobileFilterBar.displayName = 'MobileFilterBar';
