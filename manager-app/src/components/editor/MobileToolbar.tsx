import { useState, memo } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Image, Layers, SlidersHorizontal,
  Undo2, Redo2, Save, Download, Loader2, MoreHorizontal, LayoutTemplate,
  Square, RectangleVertical, RectangleHorizontal, Type as TypeIcon, Blend,
  FolderOpen, Maximize, ArrowDownToLine, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter, Copy, Upload
} from 'lucide-react';
import type { TextLayer } from '../../types';
import { GradientPicker } from './GradientPicker';
import { TEXT_PRESETS } from './editorConstants';

interface MobileToolbarProps {
  onAddText: (overrides?: Partial<TextLayer>) => void;
  onAddImage: () => void;
  onOpenLibrary: () => void;
  onAddImageFromLibrary?: () => void;
  onUpload: () => void;
  onOpenLayers: () => void;
  onOpenProperties: () => void;
  onOpenFontPicker: () => void;
  onOpenBlendPicker: () => void;
  onCloseOverlays: () => void;
  onOpenTemplates: () => void;
  onConvertBgToLayer?: () => void;
  onFitToCanvas?: () => void;
  onAlignCenterH?: () => void;
  onAlignCenterV?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onExport: () => void;
  onSetCanvasSize?: (width: number, height: number) => void;
  onSetBgColor?: (color: string) => void;
  onSetGradient?: (gradient: string | undefined) => void;
  currentGradient?: string;
  onDuplicate?: () => void;
  canvasWidth?: number;
  canvasHeight?: number;
  bgColor?: string;
  canUndo: boolean;
  canRedo: boolean;
  uploading: boolean;
  hasSelection: boolean;
  isImageSelected?: boolean;
  activeSheet?: string | null;
  gestureActive?: boolean;
}

export const MobileToolbar = memo(function MobileToolbar({
  onAddText,
  onAddImage,
  onOpenLibrary,
  onAddImageFromLibrary,
  onUpload,
  onOpenLayers,
  onOpenProperties,
  onOpenFontPicker,
  onOpenBlendPicker,
  onCloseOverlays,
  onOpenTemplates,
  onConvertBgToLayer,
  onFitToCanvas,
  onAlignCenterH,
  onAlignCenterV,
  onUndo,
  onRedo,
  onSave,
  onExport,
  onSetCanvasSize,
  onSetBgColor,
  onSetGradient,
  currentGradient,
  onDuplicate,
  canvasWidth = 1080,
  canvasHeight = 1080,
  bgColor = '#0a0f0f',
  canUndo,
  canRedo,
  uploading,
  hasSelection,
  isImageSelected = false,
  activeSheet,
  gestureActive = false,
}: MobileToolbarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-[60] safe-area-bottom"
      style={{
        opacity: gestureActive ? 0.2 : 1,
        transform: gestureActive ? 'translateY(10px)' : 'translateY(0)',
        transition: 'opacity 200ms ease, transform 200ms ease',
        pointerEvents: gestureActive ? 'none' : 'auto',
        WebkitTransform: gestureActive ? 'translateY(10px)' : 'translateZ(0)',
      }}
    >
      {/* Add element popover */}
      {addMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAddMenuOpen(false)} />
          <div
            className="absolute bottom-full left-3 mb-2 z-50 bg-surface/95 backdrop-blur-xl border border-border/30 rounded-2xl shadow-modal p-1.5 min-w-[160px]"
            style={{ animation: 'popUp 200ms cubic-bezier(0.32, 0.72, 0, 1)' }}
          >
            <button
              onClick={() => { onAddText(); setAddMenuOpen(false); }}
              className="flex items-center gap-2.5 w-full px-3 py-3 text-sm text-text-primary hover:bg-surface-hover rounded-xl transition-colors active:scale-[0.98]"
            >
              <Plus size={16} className="text-primary" /> Plain Text
            </button>
            {TEXT_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => { onAddText(preset.overrides as Partial<TextLayer>); setAddMenuOpen(false); }}
                className="flex items-center gap-2.5 w-full px-3 py-3 text-sm text-text-secondary hover:bg-surface-hover rounded-xl transition-colors active:scale-[0.98]"
              >
                <span className="w-4" /> {preset.label}
              </button>
            ))}
            <div className="h-px bg-border/40 my-1 mx-2" />
            <button
              onClick={() => { onAddImage(); setAddMenuOpen(false); }}
              className="flex items-center gap-2.5 w-full px-3 py-3 text-sm text-text-secondary hover:bg-surface-hover rounded-xl transition-colors active:scale-[0.98]"
            >
              <Image size={16} className="text-primary" /> Image Layer
            </button>
            {onAddImageFromLibrary && (
              <button
                onClick={() => { onAddImageFromLibrary(); setAddMenuOpen(false); }}
                className="flex items-center gap-2.5 w-full px-3 py-3 text-sm text-text-secondary hover:bg-surface-hover rounded-xl transition-colors active:scale-[0.98]"
              >
                <FolderOpen size={16} className="text-primary" /> From Library
              </button>
            )}
          </div>
        </>
      )}

      {/* More — half-sheet drawer (portaled to body to escape toolbar's transform containment) */}
      {moreOpen && createPortal(
        <>
          <div
            className="fixed inset-0 z-[65]"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)', animation: 'fadeIn 200ms ease-out' }}
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[66] bg-surface/98 backdrop-blur-2xl border-t border-border/20 rounded-t-3xl safe-area-bottom"
            style={{
              maxHeight: '70vh',
              animation: 'sheetSlideUp 300ms cubic-bezier(0.32, 0.72, 0, 1)',
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border/60" />
            </div>

            <div className="overflow-y-auto px-5 pb-6 space-y-5" style={{ maxHeight: 'calc(70vh - 24px)', WebkitOverflowScrolling: 'touch' }}>

              {/* ── Background section ── */}
              {onSetBgColor && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Background</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-text-muted">Solid</span>
                      <input
                        type="color"
                        value={bgColor}
                        onChange={(e) => onSetBgColor(e.target.value)}
                        className="w-10 h-10 rounded-xl cursor-pointer border-2 border-border/40"
                      />
                    </div>
                  </div>
                  {onSetGradient && (
                    <GradientPicker
                      currentGradient={currentGradient}
                      onSelect={onSetGradient}
                      mobile
                    />
                  )}
                  {/* Background image buttons */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => { onOpenLibrary(); setMoreOpen(false); }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-surface-hover/60 text-text-secondary text-sm font-medium active:scale-[0.98] transition-all"
                    >
                      <FolderOpen size={16} /> Library
                    </button>
                    <button
                      onClick={() => { onUpload(); setMoreOpen(false); }}
                      disabled={uploading}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-surface-hover/60 text-text-secondary text-sm font-medium active:scale-[0.98] transition-all disabled:opacity-40"
                    >
                      {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      Upload BG
                    </button>
                  </div>
                </div>
              )}

              {/* ── Canvas size section ── */}
              {onSetCanvasSize && (
                <div>
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 block">Canvas Size</span>
                  <div className="grid grid-cols-4 gap-2">
                    {([
                      { w: 1080, h: 1080, icon: Square, label: 'Square', ratio: '1:1' },
                      { w: 1080, h: 1350, icon: RectangleVertical, label: 'Post', ratio: '4:5' },
                      { w: 1080, h: 1920, icon: RectangleVertical, label: 'Story', ratio: '9:16' },
                      { w: 1920, h: 1080, icon: RectangleHorizontal, label: 'Wide', ratio: '16:9' },
                    ] as const).map(({ w, h, icon: SIcon, label: sLabel, ratio }) => {
                      const isActive = canvasWidth === w && canvasHeight === h;
                      return (
                        <button
                          key={ratio}
                          onClick={() => onSetCanvasSize(w, h)}
                          className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl transition-all active:scale-95 ${
                            isActive
                              ? 'bg-primary/15 ring-2 ring-primary'
                              : 'bg-surface-hover/60 hover:bg-surface-hover'
                          }`}
                        >
                          <SIcon
                            size={20}
                            className={`${isActive ? 'text-primary' : 'text-text-muted'} ${ratio === '9:16' ? 'scale-y-125' : ''}`}
                          />
                          <span className={`text-[11px] font-semibold ${isActive ? 'text-primary' : 'text-text-secondary'}`}>
                            {sLabel}
                          </span>
                          <span className={`text-[10px] ${isActive ? 'text-primary/70' : 'text-text-muted'}`}>
                            {ratio}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Actions section ── */}
              {(hasSelection || onFitToCanvas || onConvertBgToLayer) && (
                <div>
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 block">Actions</span>
                  <div className="grid grid-cols-3 gap-2">
                    {hasSelection && onDuplicate && (
                      <SheetActionButton icon={Copy} label="Duplicate" onClick={() => { onDuplicate(); setMoreOpen(false); }} />
                    )}
                    {hasSelection && onAlignCenterH && (
                      <SheetActionButton icon={AlignHorizontalJustifyCenter} label="Center H" onClick={() => { onAlignCenterH(); setMoreOpen(false); }} />
                    )}
                    {hasSelection && onAlignCenterV && (
                      <SheetActionButton icon={AlignVerticalJustifyCenter} label="Center V" onClick={() => { onAlignCenterV(); setMoreOpen(false); }} />
                    )}
                    {onFitToCanvas && (
                      <SheetActionButton icon={Maximize} label="Fit Canvas" onClick={() => { onFitToCanvas(); setMoreOpen(false); }} />
                    )}
                    {onConvertBgToLayer && (
                      <SheetActionButton icon={ArrowDownToLine} label="BG → Layer" onClick={() => { onConvertBgToLayer(); setMoreOpen(false); }} />
                    )}
                  </div>
                </div>
              )}

              {/* ── Quick links ── */}
              <div className="flex gap-2">
                <button
                  onClick={() => { onOpenTemplates(); setMoreOpen(false); }}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-surface-hover/60 text-text-secondary text-sm font-medium active:scale-[0.98] transition-all"
                >
                  <LayoutTemplate size={16} />
                  Templates
                </button>
                <button
                  onClick={() => { onExport(); setMoreOpen(false); }}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-surface-hover/60 text-text-secondary text-sm font-medium active:scale-[0.98] transition-all"
                >
                  <Download size={16} />
                  Export
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Main toolbar — single row, anchored to bottom */}
      <div className="flex items-center justify-around px-2 py-1.5 bg-surface/95 backdrop-blur-xl border-t border-border/30">
        <ToolButton icon={Plus} label="Add" onClick={() => { if (!addMenuOpen) onCloseOverlays(); setAddMenuOpen(!addMenuOpen); setMoreOpen(false); }} active={addMenuOpen} />
        <ToolButton icon={Layers} label="Layers" onClick={onOpenLayers} highlighted={activeSheet === 'layers'} />
        {hasSelection && !isImageSelected && (
          <ToolButton
            icon={TypeIcon}
            label="Font"
            onClick={onOpenFontPicker}
          />
        )}
        {hasSelection && isImageSelected && (
          <ToolButton
            icon={Blend}
            label="Blend"
            onClick={onOpenBlendPicker}
          />
        )}
        <ToolButton
          icon={SlidersHorizontal}
          label="Edit"
          onClick={onOpenProperties}
          active={hasSelection}
          highlighted={activeSheet === 'properties'}
        />
        <ToolButton icon={Undo2} label="Undo" onClick={onUndo} disabled={!canUndo} />
        <ToolButton icon={Redo2} label="Redo" onClick={onRedo} disabled={!canRedo} />
        <ToolButton icon={Save} label="Save" onClick={onSave} primary />
        <ToolButton icon={MoreHorizontal} label="More" onClick={() => { if (!moreOpen) onCloseOverlays(); setMoreOpen(!moreOpen); setAddMenuOpen(false); }} active={moreOpen} />
      </div>

      {/* Toolbar-specific keyframe (shared ones are in index.css) */}
      <style>{`
        @keyframes sheetSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
});

MobileToolbar.displayName = 'MobileToolbar';

function ToolButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
  primary,
  loading,
  highlighted,
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  primary?: boolean;
  loading?: boolean;
  highlighted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all min-h-[48px] min-w-[48px] px-2 active:scale-90 ${
        highlighted
          ? 'text-primary bg-primary/10'
          : primary
          ? 'text-primary'
          : active
          ? 'text-primary'
          : disabled
          ? 'text-text-muted opacity-30'
          : 'text-text-muted'
      }`}
    >
      {loading ? <Loader2 size={20} className="animate-spin" /> : <Icon size={20} />}
      <span className="text-[10px] leading-none font-medium">{label}</span>
    </button>
  );
}

function SheetActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl bg-surface-hover/60 text-text-secondary hover:bg-surface-hover active:scale-95 transition-all"
    >
      <Icon size={18} />
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}

