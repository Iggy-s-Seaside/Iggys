import { useState, useRef, useCallback } from 'react';
import { Camera, Save, Loader2, X, ArrowRight, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useImageUpload } from '../../hooks/useImageUpload';
import { useSupabaseCRUD } from '../../hooks/useSupabaseCRUD';
import type { Special } from '../../types';

interface QuickPostModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

type Step = 'photo' | 'text' | 'save';

const TEXT_STYLES = [
  { label: 'Bold White', style: { color: '#ffffff', fontWeight: 'bold', fontSize: '2rem', textShadow: '0 2px 8px rgba(0,0,0,0.5)' } },
  { label: 'Teal Glow', style: { color: '#2dd4bf', fontWeight: 'bold', fontSize: '2rem', textShadow: '0 0 20px rgba(45,212,191,0.5)' } },
  { label: 'Amber Pop', style: { color: '#f59e0b', fontWeight: 'bold', fontSize: '1.75rem', textShadow: '0 2px 8px rgba(0,0,0,0.5)' } },
  { label: 'Clean White', style: { color: '#ffffff', fontWeight: '500', fontSize: '1.5rem', textShadow: 'none' } },
];

export function QuickPostModal({ open, onClose, onSaved }: QuickPostModalProps) {
  const [step, setStep] = useState<Step>('photo');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [overlayText, setOverlayText] = useState('');
  const [textStyleIndex, setTextStyleIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveForm, setSaveForm] = useState({
    title: '',
    description: '',
    type: 'drink' as 'drink' | 'food' | 'seasonal',
    price: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { upload } = useImageUpload();
  const { create } = useSupabaseCRUD<Special>('specials');

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string);
      setStep('text');
    };
    reader.readAsDataURL(file);
  }, []);

  const generateFinalImage = useCallback(async (): Promise<File | null> => {
    if (!imagePreview || !canvasRef.current) return null;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const img = new window.Image();
    img.crossOrigin = 'anonymous';

    return new Promise((resolve) => {
      img.onload = () => {
        canvas.width = 1080;
        canvas.height = 1080;

        // Draw image centered/cropped to square
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 1080, 1080);

        // Apply dark overlay
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, 0, 1080, 1080);

        // Draw text if present
        if (overlayText) {
          const style = TEXT_STYLES[textStyleIndex].style;
          const fontSize = parseInt(style.fontSize) * 27; // scale up from rem
          ctx.font = `${style.fontWeight} ${fontSize}px Inter, sans-serif`;
          ctx.fillStyle = style.color;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Text shadow
          if (style.textShadow !== 'none') {
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 16;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 4;
          }

          // Word wrap
          const words = overlayText.split(' ');
          const maxWidth = 900;
          const lines: string[] = [];
          let currentLine = words[0];

          for (let i = 1; i < words.length; i++) {
            const testLine = currentLine + ' ' + words[i];
            if (ctx.measureText(testLine).width > maxWidth) {
              lines.push(currentLine);
              currentLine = words[i];
            } else {
              currentLine = testLine;
            }
          }
          lines.push(currentLine);

          const lineHeight = fontSize * 1.2;
          const startY = 540 - ((lines.length - 1) * lineHeight) / 2;
          lines.forEach((line, i) => {
            ctx.fillText(line, 540, startY + i * lineHeight);
          });
        }

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], `quick-special-${Date.now()}.png`, { type: 'image/png' }));
          } else {
            resolve(null);
          }
        }, 'image/png');
      };
      img.onerror = () => resolve(null);
      img.src = imagePreview;
    });
  }, [imagePreview, overlayText, textStyleIndex]);

  const handleSave = async () => {
    setSaving(true);
    const file = await generateFinalImage();
    let imageUrl: string | null = null;

    if (file) {
      imageUrl = await upload(file, 'specials');
    }

    const ok = await create({
      title: saveForm.title,
      description: saveForm.description,
      type: saveForm.type,
      price: saveForm.price || null,
      image_url: imageUrl,
      active: true,
    } as Omit<Special, 'id' | 'created_at'>);

    setSaving(false);
    if (ok) {
      toast.success('Special posted!');
      resetState();
      onSaved?.();
      onClose();
    }
  };

  const resetState = () => {
    setStep('photo');
    setImagePreview(null);
    setOverlayText('');
    setTextStyleIndex(0);
    setSaveForm({ title: '', description: '', type: 'drink', price: '' });
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-md bg-surface rounded-2xl shadow-modal overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold text-text-primary">Quick Post</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">
              Step {step === 'photo' ? 1 : step === 'text' ? 2 : 3} of 3
            </span>
            <button onClick={handleClose} className="p-1 rounded-lg hover:bg-surface-hover">
              <X size={18} className="text-text-muted" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {step === 'photo' && (
            <div className="p-6 flex flex-col items-center gap-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors bg-surface-hover/50"
              >
                <Camera size={40} className="text-text-muted" />
                <p className="text-sm text-text-secondary font-medium">Tap to take photo or choose from gallery</p>
                <p className="text-xs text-text-muted">Recommended: Square photo</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {step === 'text' && imagePreview && (
            <div className="p-4 space-y-4">
              {/* Preview with text overlay */}
              <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-black">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover opacity-70" />
                {overlayText && (
                  <div className="absolute inset-0 flex items-center justify-center p-6">
                    <p
                      className="text-center break-words max-w-full"
                      style={TEXT_STYLES[textStyleIndex].style}
                    >
                      {overlayText}
                    </p>
                  </div>
                )}
              </div>

              {/* Text input */}
              <input
                type="text"
                className="input-field text-center"
                placeholder="Add text overlay (optional)"
                value={overlayText}
                onChange={(e) => setOverlayText(e.target.value)}
                autoFocus
              />

              {/* Style picker */}
              {overlayText && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {TEXT_STYLES.map((s, i) => (
                    <button
                      key={s.label}
                      onClick={() => setTextStyleIndex(i)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        i === textStyleIndex
                          ? 'bg-primary text-white'
                          : 'bg-surface-hover text-text-secondary'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'save' && (
            <div className="p-4 space-y-4">
              {/* Thumbnail */}
              {imagePreview && (
                <div className="relative w-full h-32 rounded-xl overflow-hidden bg-black">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover opacity-70" />
                  {overlayText && (
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                      <p className="text-center text-white font-bold text-sm" style={TEXT_STYLES[textStyleIndex].style}>
                        {overlayText}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="label">Title *</label>
                <input
                  className="input-field"
                  value={saveForm.title}
                  onChange={(e) => setSaveForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Happy Hour Special"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input-field min-h-[60px] resize-y"
                  value={saveForm.description}
                  onChange={(e) => setSaveForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="$5 wells, $3 drafts..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Type</label>
                  <select
                    className="input-field"
                    value={saveForm.type}
                    onChange={(e) => setSaveForm(f => ({ ...f, type: e.target.value as 'drink' | 'food' | 'seasonal' }))}
                  >
                    <option value="drink">Drink</option>
                    <option value="food">Food</option>
                    <option value="seasonal">Seasonal</option>
                  </select>
                </div>
                <div>
                  <label className="label">Price</label>
                  <input
                    className="input-field"
                    value={saveForm.price}
                    onChange={(e) => setSaveForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="$8"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0">
          {step !== 'photo' ? (
            <button
              onClick={() => setStep(step === 'save' ? 'text' : 'photo')}
              className="btn-ghost text-sm"
            >
              <ArrowLeft size={16} /> Back
            </button>
          ) : (
            <div />
          )}

          {step === 'text' && (
            <button
              onClick={() => setStep('save')}
              className="btn-primary text-sm"
            >
              Next <ArrowRight size={16} />
            </button>
          )}

          {step === 'save' && (
            <button
              onClick={handleSave}
              disabled={saving || !saveForm.title}
              className="btn-primary text-sm"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Post Special
            </button>
          )}
        </div>

        {/* Hidden canvas for image generation */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
