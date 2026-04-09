import { Sun, Contrast, Droplets, CloudFog, RotateCcw, Palette, ArrowDownToLine } from 'lucide-react';
import type { ImageFilters } from '../../types';
import { FILTER_PRESETS } from '../../types';
import { OVERLAY_COLORS } from './editorConstants';

interface ImageAdjustmentsProps {
  filters: ImageFilters;
  hasBackground: boolean;
  onUpdate: (filters: Partial<ImageFilters>) => void;
  onReset: () => void;
  onConvertToLayer?: () => void;
}

export function ImageAdjustments({ filters, hasBackground, onUpdate, onReset, onConvertToLayer }: ImageAdjustmentsProps) {
  if (!hasBackground) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-text-muted">Upload a background image to use adjustments & filters</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-sm">
      {/* Filter Presets */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Presets</h4>
          <button onClick={onReset} className="text-xs text-text-muted hover:text-primary flex items-center gap-1" title="Reset all">
            <RotateCcw size={11} /> Reset
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {FILTER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onUpdate(preset.filters)}
              className={`rounded-lg p-1.5 text-center transition-all border ${
                filters.preset === preset.id || (preset.id === 'none' && !filters.preset)
                  ? 'border-primary bg-primary-50 text-primary-dark'
                  : 'border-border bg-surface-hover text-text-secondary hover:border-primary/30'
              }`}
            >
              <span className="text-[10px] font-medium block truncate">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Manual Adjustments */}
      <div>
        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Adjustments</h4>

        <Slider
          icon={<Sun size={13} />}
          label="Brightness"
          value={filters.brightness}
          min={0}
          max={200}
          onChange={(v) => onUpdate({ brightness: v, preset: null })}
        />
        <Slider
          icon={<Contrast size={13} />}
          label="Contrast"
          value={filters.contrast}
          min={0}
          max={200}
          onChange={(v) => onUpdate({ contrast: v, preset: null })}
        />
        <Slider
          icon={<Droplets size={13} />}
          label="Saturation"
          value={filters.saturation}
          min={0}
          max={200}
          onChange={(v) => onUpdate({ saturation: v, preset: null })}
        />
        <Slider
          icon={<CloudFog size={13} />}
          label="Blur"
          value={filters.blur}
          min={0}
          max={20}
          onChange={(v) => onUpdate({ blur: v, preset: null })}
        />
      </div>

      {/* Color Overlay */}
      <div>
        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
          <Palette size={13} className="inline mr-1" />
          Color Overlay
        </h4>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="color"
            value={filters.overlayColor}
            onChange={(e) => onUpdate({ overlayColor: e.target.value, preset: null })}
            className="w-8 h-8 rounded cursor-pointer border border-border shrink-0"
          />
          <div className="flex-1">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(filters.overlayOpacity * 100)}
              onChange={(e) => onUpdate({ overlayOpacity: Number(e.target.value) / 100, preset: null })}
              className="w-full accent-primary"
            />
          </div>
          <span className="text-xs text-text-muted w-8 text-right">{Math.round(filters.overlayOpacity * 100)}%</span>
        </div>

        {/* Quick overlay colors */}
        <div className="flex gap-1">
          {OVERLAY_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onUpdate({ overlayColor: c, overlayOpacity: Math.max(filters.overlayOpacity, 0.2), preset: null })}
              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                filters.overlayColor === c ? 'border-primary scale-110' : 'border-border'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Convert to Layer */}
      {onConvertToLayer && (
        <div className="pt-2 border-t border-border">
          <button
            onClick={onConvertToLayer}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-text-secondary bg-surface-hover hover:bg-surface-active hover:text-primary transition-all active:scale-[0.98]"
          >
            <ArrowDownToLine size={13} />
            Convert to Layer (move, resize, blend)
          </button>
        </div>
      )}
    </div>
  );
}

function Slider({
  icon,
  label,
  value,
  min,
  max,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <span className="text-text-muted shrink-0">{icon}</span>
      <span className="text-xs text-text-secondary w-16 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-primary"
      />
      <span className="text-xs text-text-muted w-8 text-right">{value}</span>
    </div>
  );
}
