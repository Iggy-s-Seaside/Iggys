import { useState } from 'react';
import { X } from 'lucide-react';
import { GRADIENT_PRESETS } from '../../data/gradientPresets';
import { BRAND_COLORS } from '../../types';

interface GradientPickerProps {
  currentGradient: string | undefined;
  onSelect: (gradient: string | undefined) => void;
  mobile?: boolean;
}

export function GradientPicker({ currentGradient, onSelect, mobile = false }: GradientPickerProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [topColor, setTopColor] = useState('#0a0f0f');
  const [bottomColor, setBottomColor] = useState('#2dd4bf');
  const [direction, setDirection] = useState<'vertical' | 'diagonal'>('vertical');

  const applyCustom = (top: string, bottom: string, dir: 'vertical' | 'diagonal') => {
    const angle = dir === 'vertical' ? '180deg' : '135deg';
    onSelect(`linear-gradient(${angle}, ${top} 0%, ${bottom} 100%)`);
  };

  if (mobile) {
    return (
      <div className="space-y-3">
        <span className="text-[11px] text-text-muted font-medium">Gradient</span>

        {/* Grid of swatches — 6 columns, large touch targets */}
        <div className="grid grid-cols-6 gap-2">
          {/* None / clear */}
          <button
            onClick={() => onSelect(undefined)}
            className={`aspect-square rounded-xl border-2 transition-all flex items-center justify-center active:scale-90 ${
              !currentGradient ? 'border-primary bg-surface-hover' : 'border-border/40 bg-surface-hover/40'
            }`}
            aria-label="No gradient"
          >
            <X size={16} className={!currentGradient ? 'text-primary' : 'text-text-muted'} />
          </button>

          {GRADIENT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onSelect(preset.gradient)}
              className={`aspect-square rounded-xl border-2 transition-all active:scale-90 ${
                currentGradient === preset.gradient
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'border-border/30'
              }`}
              style={{ background: preset.gradient }}
              aria-label={preset.name}
            />
          ))}

          {/* Custom toggle */}
          <button
            onClick={() => setCustomOpen(!customOpen)}
            className={`aspect-square rounded-xl text-[10px] font-semibold transition-all flex items-center justify-center active:scale-90 ${
              customOpen
                ? 'bg-primary text-white border-2 border-primary'
                : 'bg-surface-hover/60 text-text-secondary border-2 border-border/30'
            }`}
          >
            Mix
          </button>
        </div>

        {/* Custom gradient builder */}
        {customOpen && (
          <div className="bg-surface-hover/60 rounded-2xl p-4 space-y-4">
            {/* Top color */}
            <div className="space-y-2">
              <span className="text-[11px] text-text-muted font-medium">Top Color</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={topColor}
                  onChange={(e) => {
                    setTopColor(e.target.value);
                    applyCustom(e.target.value, bottomColor, direction);
                  }}
                  className="w-11 h-11 rounded-xl cursor-pointer border-2 border-border/40"
                />
                {BRAND_COLORS.slice(0, 6).map((c) => (
                  <button
                    key={`top-${c}`}
                    onClick={() => {
                      setTopColor(c);
                      applyCustom(c, bottomColor, direction);
                    }}
                    className={`w-9 h-9 rounded-lg border-2 transition-all active:scale-90 ${
                      topColor === c ? 'border-primary ring-1 ring-primary/30' : 'border-border/30'
                    }`}
                    style={{ background: c }}
                    aria-label={`Top color ${c}`}
                  />
                ))}
              </div>
            </div>

            {/* Bottom color */}
            <div className="space-y-2">
              <span className="text-[11px] text-text-muted font-medium">Bottom Color</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bottomColor}
                  onChange={(e) => {
                    setBottomColor(e.target.value);
                    applyCustom(topColor, e.target.value, direction);
                  }}
                  className="w-11 h-11 rounded-xl cursor-pointer border-2 border-border/40"
                />
                {BRAND_COLORS.slice(0, 6).map((c) => (
                  <button
                    key={`bot-${c}`}
                    onClick={() => {
                      setBottomColor(c);
                      applyCustom(topColor, c, direction);
                    }}
                    className={`w-9 h-9 rounded-lg border-2 transition-all active:scale-90 ${
                      bottomColor === c ? 'border-primary ring-1 ring-primary/30' : 'border-border/30'
                    }`}
                    style={{ background: c }}
                    aria-label={`Bottom color ${c}`}
                  />
                ))}
              </div>
            </div>

            {/* Direction toggle */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-text-muted font-medium">Direction</span>
              <div className="flex gap-1.5 flex-1">
                <button
                  onClick={() => {
                    setDirection('vertical');
                    applyCustom(topColor, bottomColor, 'vertical');
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                    direction === 'vertical' ? 'bg-primary text-white' : 'bg-surface text-text-secondary'
                  }`}
                >
                  Vertical
                </button>
                <button
                  onClick={() => {
                    setDirection('diagonal');
                    applyCustom(topColor, bottomColor, 'diagonal');
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                    direction === 'diagonal' ? 'bg-primary text-white' : 'bg-surface text-text-secondary'
                  }`}
                >
                  Diagonal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop layout (unchanged)
  return (
    <div className="space-y-2">
      <span className="text-xs text-text-muted font-medium">Gradient</span>

      {/* Preset swatches */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
        {/* None / clear */}
        <button
          onClick={() => onSelect(undefined)}
          className={`shrink-0 w-9 h-9 rounded-lg border-2 transition-all flex items-center justify-center ${
            !currentGradient ? 'border-primary' : 'border-border hover:border-text-muted'
          }`}
          aria-label="No gradient"
        >
          <X size={12} className="text-text-muted" />
        </button>

        {GRADIENT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSelect(preset.gradient)}
            className={`shrink-0 w-9 h-9 rounded-lg border-2 transition-all ${
              currentGradient === preset.gradient ? 'border-primary scale-110' : 'border-border hover:border-text-muted'
            }`}
            style={{ background: preset.gradient }}
            aria-label={preset.name}
            title={preset.name}
          />
        ))}

        {/* Custom toggle */}
        <button
          onClick={() => setCustomOpen(!customOpen)}
          className={`shrink-0 px-2.5 h-9 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
            customOpen ? 'bg-primary text-white' : 'bg-surface-hover text-text-secondary hover:text-text-primary'
          }`}
        >
          Custom
        </button>
      </div>

      {/* Custom gradient builder */}
      {customOpen && (
        <div className="bg-surface-hover rounded-lg p-3 space-y-3 animate-fade-in">
          {/* Top color */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-text-muted">Top Color</span>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={topColor}
                onChange={(e) => {
                  setTopColor(e.target.value);
                  applyCustom(e.target.value, bottomColor, direction);
                }}
                className="w-9 h-9 rounded-lg cursor-pointer border border-border"
              />
              {BRAND_COLORS.slice(0, 6).map((c) => (
                <button
                  key={`top-${c}`}
                  onClick={() => {
                    setTopColor(c);
                    applyCustom(c, bottomColor, direction);
                  }}
                  className={`w-7 h-7 rounded-md border transition-all ${
                    topColor === c ? 'border-primary scale-110' : 'border-border'
                  }`}
                  style={{ background: c }}
                  aria-label={`Top color ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Bottom color */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-text-muted">Bottom Color</span>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={bottomColor}
                onChange={(e) => {
                  setBottomColor(e.target.value);
                  applyCustom(topColor, e.target.value, direction);
                }}
                className="w-9 h-9 rounded-lg cursor-pointer border border-border"
              />
              {BRAND_COLORS.slice(0, 6).map((c) => (
                <button
                  key={`bot-${c}`}
                  onClick={() => {
                    setBottomColor(c);
                    applyCustom(topColor, c, direction);
                  }}
                  className={`w-7 h-7 rounded-md border transition-all ${
                    bottomColor === c ? 'border-primary scale-110' : 'border-border'
                  }`}
                  style={{ background: c }}
                  aria-label={`Bottom color ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Direction toggle */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-muted">Direction</span>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setDirection('vertical');
                  applyCustom(topColor, bottomColor, 'vertical');
                }}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  direction === 'vertical' ? 'bg-primary text-white' : 'bg-surface text-text-secondary'
                }`}
              >
                Vertical
              </button>
              <button
                onClick={() => {
                  setDirection('diagonal');
                  applyCustom(topColor, bottomColor, 'diagonal');
                }}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  direction === 'diagonal' ? 'bg-primary text-white' : 'bg-surface text-text-secondary'
                }`}
              >
                Diagonal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
