import { useRef } from 'react';
import { Camera } from 'lucide-react';

interface ScanOrderButtonProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export function ScanOrderButton({ onFileSelected, disabled }: ScanOrderButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
      // Reset so same file can be re-selected
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="btn-secondary flex items-center gap-2"
      >
        <Camera size={18} />
        <span className="hidden sm:inline">Scan Order</span>
      </button>
    </>
  );
}
