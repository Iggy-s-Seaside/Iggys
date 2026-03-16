interface SizeSelectorProps {
  sizes: string[];
  selectedSize: string | null;
  onSelect: (size: string) => void;
}

export default function SizeSelector({ sizes, selectedSize, onSelect }: SizeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {sizes.map((size) => (
        <button
          key={size}
          onClick={() => onSelect(size)}
          className={`w-10 h-10 rounded-lg text-sm font-medium transition-all flex items-center justify-center ${
            selectedSize === size
              ? 'bg-primary text-background'
              : 'bg-white/5 text-text-muted hover:bg-white/10 border border-white/10'
          }`}
        >
          {size}
        </button>
      ))}
    </div>
  );
}
