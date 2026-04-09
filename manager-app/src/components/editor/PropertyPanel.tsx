import { useState, memo } from 'react';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Trash2, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import type { TextLayer } from '../../types';
import { BRAND_COLORS, DEFAULT_IMAGE_FILTERS } from '../../types';
import { FontPicker } from './FontPicker';

interface PropertyPanelProps {
  layer: TextLayer;
  onUpdate: (changes: Partial<TextLayer>) => void;
  onDelete: () => void;
  canvasWidth?: number;
  canvasHeight?: number;
}

/** Convert any CSS color to hex for <input type="color"> */
function toHex(color: string): string {
  if (color.startsWith('#')) return color.length === 4 || color.length === 7 ? color : color.slice(0, 7);
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    const r = Number(m[1]).toString(16).padStart(2, '0');
    const g = Number(m[2]).toString(16).padStart(2, '0');
    const b = Number(m[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return '#000000';
}

import { BLEND_MODES } from './editorConstants';

// Reusable slider row with label and live value
function SliderRow({ label, value, min, max, step = 1, unit = '', onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const display = step < 1 ? value.toFixed(step < 0.1 ? 2 : 1) : String(Math.round(value));
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-text-muted">{label}</label>
        <span className="text-xs font-medium text-text-secondary tabular-nums">{display}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary h-2 rounded-full"
      />
    </div>
  );
}

export const PropertyPanel = memo(function PropertyPanel({ layer, onUpdate, onDelete, canvasWidth = 1080, canvasHeight = 1920 }: PropertyPanelProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isImage = layer.elementType === 'image' || layer.elementType === 'video';
  const isDivider = layer.elementType === 'divider';
  const isText = !isImage && !isDivider;

  const toggleFontStyle = (style: 'bold' | 'italic') => {
    const parts = layer.fontStyle.split(' ').filter(Boolean);
    const has = parts.includes(style);
    const next = has ? parts.filter((p) => p !== style) : [...parts, style];
    onUpdate({ fontStyle: next.length === 0 ? 'normal' : next.join(' ') });
  };

  const isBold = layer.fontStyle.includes('bold');
  const isItalic = layer.fontStyle.includes('italic');
  const isUnderline = layer.textDecoration === 'underline';

  return (
    <div className="space-y-4 text-sm">

      {/* ─── Text Content (text & divider only) ─── */}
      {!isImage && (
        <Section title={isDivider ? 'Label' : 'Text'}>
          <textarea
            className="input-field min-h-[56px] resize-y text-[13px] rounded-xl"
            value={isDivider ? (layer.dividerLabel ?? layer.text) : layer.text}
            onChange={(e) => {
              if (isDivider) {
                onUpdate({ text: e.target.value, dividerLabel: e.target.value });
              } else {
                onUpdate({ text: e.target.value });
              }
            }}
          />
        </Section>
      )}

      {/* ─── Divider-specific ─── */}
      {isDivider && (
        <Section title="Divider Line">
          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs text-text-muted">Color</label>
            <input
              type="color"
              value={layer.dividerLineColor || layer.fill}
              onChange={(e) => onUpdate({ dividerLineColor: e.target.value })}
              className="w-10 h-10 rounded-lg cursor-pointer border border-border ml-auto"
            />
          </div>
          <SliderRow label="Thickness" value={layer.dividerLineThickness ?? 1} min={1} max={10} onChange={(v) => onUpdate({ dividerLineThickness: v })} />
          <SliderRow label="Opacity" value={layer.dividerLineOpacity ?? 0.4} min={0} max={1} step={0.05} onChange={(v) => onUpdate({ dividerLineOpacity: v })} />
          <SliderRow label="Gap" value={layer.dividerGap ?? 16} min={0} max={60} onChange={(v) => onUpdate({ dividerGap: v })} />
          <SliderRow label="Side Padding" value={layer.dividerPadding ?? 40} min={0} max={200} onChange={(v) => onUpdate({ dividerPadding: v })} />
        </Section>
      )}

      {/* ─── Typography (text & divider only) ─── */}
      {!isImage && (
        <Section title="Typography">
          <div className="mb-3">
            <FontPicker
              value={layer.fontFamily}
              onChange={(font) => onUpdate({ fontFamily: font })}
            />
          </div>

          <SliderRow label="Size" value={layer.fontSize} min={8} max={200} unit="px" onChange={(v) => onUpdate({ fontSize: v })} />

          {/* Style buttons */}
          <div className="flex gap-1.5 mb-3">
            <StyleButton active={isBold} onClick={() => toggleFontStyle('bold')} label="Bold"><Bold size={14} /></StyleButton>
            <StyleButton active={isItalic} onClick={() => toggleFontStyle('italic')} label="Italic"><Italic size={14} /></StyleButton>
            <StyleButton active={isUnderline} onClick={() => onUpdate({ textDecoration: isUnderline ? '' : 'underline' })} label="Underline"><Underline size={14} /></StyleButton>
            <div className="w-px bg-border/40 mx-0.5" />
            <StyleButton active={layer.align === 'left'} onClick={() => onUpdate({ align: 'left' })} label="Left"><AlignLeft size={14} /></StyleButton>
            <StyleButton active={layer.align === 'center'} onClick={() => onUpdate({ align: 'center' })} label="Center"><AlignCenter size={14} /></StyleButton>
            <StyleButton active={layer.align === 'right'} onClick={() => onUpdate({ align: 'right' })} label="Right"><AlignRight size={14} /></StyleButton>
          </div>

          <SliderRow label="Letter Spacing" value={layer.letterSpacing} min={-5} max={30} step={0.5} onChange={(v) => onUpdate({ letterSpacing: v })} />
          <SliderRow label="Line Height" value={layer.lineHeight || 1.3} min={0.8} max={3} step={0.1} unit="x" onChange={(v) => onUpdate({ lineHeight: v })} />
        </Section>
      )}

      {/* ─── Colors (text & divider only) ─── */}
      {!isImage && (
        <Section title="Colors">
          <div className="mb-3">
            <label className="text-xs text-text-muted mb-1.5 block">Fill Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={layer.fill}
                onChange={(e) => onUpdate({ fill: e.target.value })}
                className="w-10 h-10 rounded-lg cursor-pointer border border-border"
              />
              <div className="flex gap-1.5 flex-wrap">
                {BRAND_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => onUpdate({ fill: c })}
                    className={`w-10 h-10 rounded-full border-2 transition-all active:scale-90 ${layer.fill === c ? 'border-primary scale-110 shadow-md' : 'border-border/50'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-text-muted">Stroke</label>
            <input
              type="color"
              value={layer.stroke || '#000000'}
              onChange={(e) => onUpdate({ stroke: e.target.value })}
              className="w-10 h-10 rounded-lg cursor-pointer border border-border"
            />
          </div>
          <SliderRow label="Stroke Width" value={layer.strokeWidth} min={0} max={10} step={0.5} unit="px" onChange={(v) => onUpdate({ strokeWidth: v })} />
          <SliderRow label="Opacity" value={layer.opacity} min={0} max={1} step={0.05} onChange={(v) => onUpdate({ opacity: v })} />
        </Section>
      )}

      {/* ─── Shadow (text only) ─── */}
      {isText && (
        <Section title="Shadow" defaultOpen={false}>
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-text-muted">Color</label>
            <input
              type="color"
              value={toHex(layer.shadowColor)}
              onChange={(e) => onUpdate({ shadowColor: e.target.value })}
              className="w-10 h-10 rounded-lg cursor-pointer border border-border"
            />
          </div>
          <SliderRow label="Blur" value={layer.shadowBlur} min={0} max={30} onChange={(v) => onUpdate({ shadowBlur: v })} />
          <SliderRow label="Offset X" value={layer.shadowOffsetX} min={-30} max={30} onChange={(v) => onUpdate({ shadowOffsetX: v })} />
          <SliderRow label="Offset Y" value={layer.shadowOffsetY} min={-30} max={30} onChange={(v) => onUpdate({ shadowOffsetY: v })} />
        </Section>
      )}

      {/* ─── Image Layer: Blending ─── */}
      {isImage && (
        <Section title="Blending">
          <label className="text-xs text-text-muted mb-1.5 block">Blend Mode</label>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {BLEND_MODES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onUpdate({ blendMode: value })}
                className={`px-2.5 py-2 text-xs rounded-lg transition-all text-center ${
                  (layer.blendMode || 'normal') === value
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-surface-hover text-text-muted hover:text-text-secondary hover:bg-surface-active'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <SliderRow label="Opacity" value={layer.opacity} min={0} max={1} step={0.05} onChange={(v) => onUpdate({ opacity: v })} />
        </Section>
      )}

      {/* ─── Image Layer: Filters ─── */}
      {isImage && (
        <Section title="Image Filters">
          <SliderRow label="Brightness" value={(layer.imageFilters ?? DEFAULT_IMAGE_FILTERS).brightness} min={0} max={200} unit="%" onChange={(v) => onUpdate({ imageFilters: { ...(layer.imageFilters ?? DEFAULT_IMAGE_FILTERS), brightness: v } })} />
          <SliderRow label="Contrast" value={(layer.imageFilters ?? DEFAULT_IMAGE_FILTERS).contrast} min={0} max={200} unit="%" onChange={(v) => onUpdate({ imageFilters: { ...(layer.imageFilters ?? DEFAULT_IMAGE_FILTERS), contrast: v } })} />
          <SliderRow label="Saturation" value={(layer.imageFilters ?? DEFAULT_IMAGE_FILTERS).saturation} min={0} max={200} unit="%" onChange={(v) => onUpdate({ imageFilters: { ...(layer.imageFilters ?? DEFAULT_IMAGE_FILTERS), saturation: v } })} />
          <SliderRow label="Blur" value={(layer.imageFilters ?? DEFAULT_IMAGE_FILTERS).blur} min={0} max={20} step={0.5} unit="px" onChange={(v) => onUpdate({ imageFilters: { ...(layer.imageFilters ?? DEFAULT_IMAGE_FILTERS), blur: v } })} />
          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs text-text-muted">Overlay</label>
            <input
              type="color"
              value={(layer.imageFilters ?? DEFAULT_IMAGE_FILTERS).overlayColor}
              onChange={(e) => onUpdate({ imageFilters: { ...(layer.imageFilters ?? DEFAULT_IMAGE_FILTERS), overlayColor: e.target.value } })}
              className="w-10 h-10 rounded-lg cursor-pointer border border-border ml-auto"
            />
          </div>
          <SliderRow label="Overlay Opacity" value={(layer.imageFilters ?? DEFAULT_IMAGE_FILTERS).overlayOpacity} min={0} max={1} step={0.05} onChange={(v) => onUpdate({ imageFilters: { ...(layer.imageFilters ?? DEFAULT_IMAGE_FILTERS), overlayOpacity: v } })} />
          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs text-text-muted">Fit</label>
            <div className="flex gap-1 ml-auto">
              {(['cover', 'contain', 'fill'] as const).map((fit) => (
                <button
                  key={fit}
                  onClick={() => onUpdate({ imageFit: fit })}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                    (layer.imageFit || 'cover') === fit
                      ? 'bg-primary text-white'
                      : 'bg-surface-hover text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {fit.charAt(0).toUpperCase() + fit.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => onUpdate({ imageFilters: { ...DEFAULT_IMAGE_FILTERS }, blendMode: 'normal' })}
            className="text-xs text-primary hover:text-primary-hover transition-colors"
          >
            Reset All
          </button>
        </Section>
      )}

      {/* ─── Image Layer: Crop ─── */}
      {isImage && (
        <Section title="Crop" defaultOpen={false}>
          <SliderRow label="Top" value={layer.imageCrop?.top ?? 0} min={0} max={50} unit="%" onChange={(v) => onUpdate({ imageCrop: { top: v, right: layer.imageCrop?.right ?? 0, bottom: layer.imageCrop?.bottom ?? 0, left: layer.imageCrop?.left ?? 0 } })} />
          <SliderRow label="Bottom" value={layer.imageCrop?.bottom ?? 0} min={0} max={50} unit="%" onChange={(v) => onUpdate({ imageCrop: { top: layer.imageCrop?.top ?? 0, right: layer.imageCrop?.right ?? 0, bottom: v, left: layer.imageCrop?.left ?? 0 } })} />
          <SliderRow label="Left" value={layer.imageCrop?.left ?? 0} min={0} max={50} unit="%" onChange={(v) => onUpdate({ imageCrop: { top: layer.imageCrop?.top ?? 0, right: layer.imageCrop?.right ?? 0, bottom: layer.imageCrop?.bottom ?? 0, left: v } })} />
          <SliderRow label="Right" value={layer.imageCrop?.right ?? 0} min={0} max={50} unit="%" onChange={(v) => onUpdate({ imageCrop: { top: layer.imageCrop?.top ?? 0, right: v, bottom: layer.imageCrop?.bottom ?? 0, left: layer.imageCrop?.left ?? 0 } })} />
          {layer.imageCrop && (layer.imageCrop.top > 0 || layer.imageCrop.right > 0 || layer.imageCrop.bottom > 0 || layer.imageCrop.left > 0) && (
            <button
              onClick={() => onUpdate({ imageCrop: undefined })}
              className="text-xs text-primary hover:text-primary-hover transition-colors"
            >
              Reset Crop
            </button>
          )}
        </Section>
      )}

      {/* ─── Position ─── */}
      <Section title="Position" defaultOpen={false}>
        <SliderRow label="X" value={Math.round(layer.x)} min={0} max={canvasWidth} onChange={(v) => onUpdate({ x: v })} />
        <SliderRow label="Y" value={Math.round(layer.y)} min={0} max={canvasHeight} onChange={(v) => onUpdate({ y: v })} />
        <SliderRow label="Width" value={Math.round(layer.width)} min={50} max={canvasWidth} onChange={(v) => onUpdate({ width: v })} />
        {isImage && (
          <SliderRow label="Height" value={Math.round(layer.imageHeight || layer.width)} min={30} max={canvasHeight} onChange={(v) => onUpdate({ imageHeight: v })} />
        )}
        <SliderRow label="Rotation" value={Math.round(layer.rotation)} min={0} max={360} unit="deg" onChange={(v) => onUpdate({ rotation: v })} />
      </Section>

      {/* ─── Advanced toggle (text & divider only) ─── */}
      {!isImage && (
        <>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl bg-surface-hover text-text-muted text-xs font-medium uppercase tracking-wider hover:bg-surface-active transition-all active:scale-[0.98]"
          >
            <Settings2 size={14} />
            Advanced
            {showAdvanced ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
          </button>

          {showAdvanced && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-text-muted">Weight</label>
                  <select
                    className="input-field text-[13px] w-full rounded-lg"
                    value={layer.fontWeight || 400}
                    onChange={(e) => onUpdate({ fontWeight: Number(e.target.value) })}
                  >
                    <option value={300}>Light (300)</option>
                    <option value={400}>Regular (400)</option>
                    <option value={500}>Medium (500)</option>
                    <option value={600}>Semi-bold (600)</option>
                    <option value={700}>Bold (700)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-muted">Transform</label>
                  <select
                    className="input-field text-[13px] w-full rounded-lg"
                    value={layer.textTransform || 'none'}
                    onChange={(e) => onUpdate({ textTransform: e.target.value as TextLayer['textTransform'] })}
                  >
                    <option value="none">None</option>
                    <option value="uppercase">UPPERCASE</option>
                    <option value="lowercase">lowercase</option>
                    <option value="capitalize">Capitalize</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-text-muted">Font Size (exact)</label>
                  <input type="number" min={1} max={400} className="input-field text-[13px] rounded-lg" value={layer.fontSize} onChange={(e) => { const v = Number(e.target.value); if (v >= 1 && v <= 400) onUpdate({ fontSize: v }); }} />
                </div>
                <div>
                  <label className="text-xs text-text-muted">Letter Spacing</label>
                  <input type="number" step={0.5} className="input-field text-[13px] rounded-lg" value={layer.letterSpacing} onChange={(e) => onUpdate({ letterSpacing: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-text-muted">X (exact)</label>
                  <input type="number" className="input-field text-[13px] rounded-lg" value={Math.round(layer.x)} onChange={(e) => onUpdate({ x: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs text-text-muted">Y (exact)</label>
                  <input type="number" className="input-field text-[13px] rounded-lg" value={Math.round(layer.y)} onChange={(e) => onUpdate({ y: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-text-muted">Width (exact)</label>
                  <input type="number" className="input-field text-[13px] rounded-lg" value={Math.round(layer.width)} onChange={(e) => onUpdate({ width: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs text-text-muted">Rotation (exact)</label>
                  <input type="number" className="input-field text-[13px] rounded-lg" value={Math.round(layer.rotation)} onChange={(e) => onUpdate({ rotation: Number(e.target.value) })} />
                </div>
              </div>
              {isText && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-text-muted">Stroke Width</label>
                    <input type="number" min={0} max={20} step={0.5} className="input-field text-[13px] rounded-lg" value={layer.strokeWidth} onChange={(e) => onUpdate({ strokeWidth: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted">Shadow Blur</label>
                    <input type="number" min={0} max={50} className="input-field text-[13px] rounded-lg" value={layer.shadowBlur} onChange={(e) => onUpdate({ shadowBlur: Number(e.target.value) })} />
                  </div>
                </div>
              )}
              {isText && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-text-muted">Shadow X</label>
                    <input type="number" className="input-field text-[13px] rounded-lg" value={layer.shadowOffsetX} onChange={(e) => onUpdate({ shadowOffsetX: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted">Shadow Y</label>
                    <input type="number" className="input-field text-[13px] rounded-lg" value={layer.shadowOffsetY} onChange={(e) => onUpdate({ shadowOffsetY: Number(e.target.value) })} />
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── Delete ─── */}
      {confirmDelete ? (
        <div className="flex gap-2">
          <button onClick={() => { onDelete(); setConfirmDelete(false); }} className="btn-danger flex-1 text-[13px] rounded-xl">Confirm Delete</button>
          <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1 text-[13px] rounded-xl">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} className="btn-danger w-full text-[13px] rounded-xl" aria-label="Delete layer">
          <Trash2 size={14} /> Delete Layer
        </button>
      )}
    </div>
  );
});

PropertyPanel.displayName = 'PropertyPanel';

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-2 text-xs font-semibold text-text-muted uppercase tracking-wider"
      >
        {title}
        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>
      <div className={`grid transition-all duration-200 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

function StyleButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`p-2.5 rounded-xl transition-all min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-90 ${
        active ? 'bg-primary text-white shadow-sm' : 'bg-surface-hover text-text-secondary hover:bg-surface-active'
      }`}
    >
      {children}
    </button>
  );
}
