import { useRef, useEffect, useCallback, useState, type ReactNode } from 'react';
import { X, ChevronLeft, Check } from 'lucide-react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  peekHeight?: number;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startY: 0, isDragging: false, startScrollTop: 0 });
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  // Slider peek-through state
  const [sliderActive, setSliderActive] = useState(false);
  const [activeSliderLabel, setActiveSliderLabel] = useState('');
  const [activeSliderValue, setActiveSliderValue] = useState('');
  const activeSliderRef = useRef<HTMLInputElement | null>(null);
  const floatingSliderRef = useRef<HTMLDivElement>(null);

  // Animated close — slide down then unmount
  const animatedClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 250);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (sliderActive) {
          setSliderActive(false);
        } else {
          animatedClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, animatedClose, sliderActive]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Detect keyboard via visualViewport
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      setKeyboardVisible(vv.height < window.innerHeight * 0.75);
    };
    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, [open]);

  // Detect slider touch start via event delegation — enters peek mode
  useEffect(() => {
    if (!open || !contentRef.current) return;
    const content = contentRef.current;

    const handleSliderStart = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.tagName !== 'INPUT' || target.type !== 'range') return;

      activeSliderRef.current = target;

      // Walk up to find the label
      const parent = target.closest('div');
      const label = parent?.querySelector('label')?.textContent
        || parent?.parentElement?.querySelector('label')?.textContent
        || '';

      setActiveSliderLabel(label);
      setActiveSliderValue(target.value);
      setSliderActive(true);
    };

    content.addEventListener('pointerdown', handleSliderStart, { passive: true });
    return () => {
      content.removeEventListener('pointerdown', handleSliderStart);
    };
  }, [open]);

  // Build the floating slider clone when peek mode activates
  useEffect(() => {
    if (!sliderActive || !activeSliderRef.current || !floatingSliderRef.current) return;

    const original = activeSliderRef.current;
    const container = floatingSliderRef.current;

    const clone = document.createElement('input');
    clone.type = 'range';
    clone.min = original.min;
    clone.max = original.max;
    clone.step = original.step || 'any';
    clone.value = original.value;
    clone.className = 'flex-1 accent-primary h-6';
    clone.style.cssText = 'height: 24px; cursor: pointer; width: 100%;';

    // React ignores programmatic .value assignment + native events.
    // We must use the native HTMLInputElement value setter to trick React
    // into recognizing the change through its synthetic event system.
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set;

    const syncToOriginal = () => {
      if (nativeSetter) {
        nativeSetter.call(original, clone.value);
      } else {
        original.value = clone.value;
      }
      original.dispatchEvent(new Event('input', { bubbles: true }));
      original.dispatchEvent(new Event('change', { bubbles: true }));
      setActiveSliderValue(clone.value);
    };

    clone.addEventListener('input', syncToOriginal);

    container.innerHTML = '';
    container.appendChild(clone);

    return () => {
      clone.removeEventListener('input', syncToOriginal);
      container.innerHTML = '';
    };
  }, [sliderActive]);

  // "Done" — exit peek mode back to full sheet
  const handleSliderDone = useCallback(() => {
    activeSliderRef.current = null;
    setSliderActive(false);
  }, []);

  // Drag-to-close — only from handle area, not content scroll
  const handleDragStart = useCallback((e: React.TouchEvent) => {
    dragRef.current.startY = e.touches[0].clientY;
    dragRef.current.isDragging = true;
  }, []);

  const handleDragMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current.isDragging || !sheetRef.current) return;
    const deltaY = e.touches[0].clientY - dragRef.current.startY;
    if (deltaY > 0) {
      sheetRef.current.style.transform = `translateY(${deltaY}px)`;
      // Dim backdrop proportionally
      sheetRef.current.style.opacity = String(Math.max(0.3, 1 - deltaY / 400));
    }
  }, []);

  const handleDragEnd = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current.isDragging || !sheetRef.current) return;
    dragRef.current.isDragging = false;
    const deltaY = e.changedTouches[0].clientY - dragRef.current.startY;
    sheetRef.current.style.transform = '';
    sheetRef.current.style.opacity = '';
    if (deltaY > 100) animatedClose();
  }, [animatedClose]);

  if (!open && !closing) return null;

  // Format value for display
  const displayValue = (() => {
    const num = Number(activeSliderValue);
    if (isNaN(num)) return activeSliderValue;
    return num % 1 === 0 ? String(num) : num.toFixed(2);
  })();

  const isClosing = closing;

  return (
    <div className="fixed inset-0 z-[70] lg:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-all duration-250"
        style={{
          backgroundColor: sliderActive ? 'rgba(0,0,0,0.1)' : isClosing ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.5)',
          animation: !isClosing ? 'fadeIn 200ms ease-out' : undefined,
        }}
        onClick={sliderActive ? handleSliderDone : animatedClose}
      />

      {/* ─── Floating slider bar (peek mode) ─── */}
      {sliderActive && (
        <div
          className="absolute bottom-0 left-0 right-0 z-[80] safe-area-bottom"
          style={{
            pointerEvents: 'auto',
            animation: 'slideUpSmall 200ms cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        >
          <div className="mx-3 mb-3 rounded-2xl bg-surface/95 backdrop-blur-xl border border-border/20 shadow-modal overflow-hidden">
            {/* Label + value + Done button */}
            <div className="flex items-center gap-3 px-4 pt-3 pb-1">
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider flex-1">
                {activeSliderLabel || 'Adjust'}
              </span>
              <span className="text-lg font-bold text-primary tabular-nums min-w-[3ch] text-right">
                {displayValue}
              </span>
              <button
                onClick={handleSliderDone}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-white text-sm font-semibold ml-2 active:scale-95 transition-transform"
              >
                <Check size={16} />
                Done
              </button>
            </div>

            {/* Slider — large touch target */}
            <div
              ref={floatingSliderRef}
              className="flex items-center px-4 py-4"
            />
          </div>
        </div>
      )}

      {/* ─── Full-screen sheet ─── */}
      <div
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 top-0 bg-surface flex flex-col"
        style={{
          height: keyboardVisible ? `${window.visualViewport?.height ?? window.innerHeight}px` : '100%',
          transition: sliderActive
            ? 'opacity 250ms cubic-bezier(0.32, 0.72, 0, 1), transform 250ms cubic-bezier(0.32, 0.72, 0, 1)'
            : keyboardVisible ? 'none' : 'height 0.3s ease',
          opacity: sliderActive ? 0 : 1,
          transform: sliderActive ? 'translateY(100%)' : undefined,
          pointerEvents: sliderActive ? 'none' : 'auto',
          animation: isClosing
            ? 'slideDown 250ms cubic-bezier(0.32, 0.72, 0, 1) forwards'
            : 'slideUp 300ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Header — frosted glass */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 shrink-0 bg-surface/95 backdrop-blur-sm">
          <button
            onClick={animatedClose}
            className="flex items-center justify-center rounded-xl hover:bg-surface-hover text-text-muted transition-colors active:scale-95"
            style={{ minWidth: 44, minHeight: 44 }}
            aria-label="Close"
          >
            <ChevronLeft size={22} />
          </button>
          <h3 className="text-base font-bold text-text-primary flex-1">{title}</h3>
          <button
            onClick={animatedClose}
            className="flex items-center justify-center rounded-xl hover:bg-surface-hover text-text-muted transition-colors active:scale-95"
            style={{ minWidth: 44, minHeight: 44 }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drag indicator */}
        <div
          className="flex justify-center py-2 cursor-grab shrink-0 active:cursor-grabbing"
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          <div className="w-9 h-1 rounded-full bg-border/60" />
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto overscroll-contain px-4 pb-20"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </div>
      </div>

      {/* Sheet-specific keyframes (fadeIn is in index.css) */}
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes slideDown { from { transform: translateY(0); opacity: 1; } to { transform: translateY(100%); opacity: 0; } }
        @keyframes slideUpSmall { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
