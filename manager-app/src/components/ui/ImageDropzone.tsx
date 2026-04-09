import { useState, useCallback, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { useImageUpload } from '../../hooks/useImageUpload';

interface ImageDropzoneProps {
  value: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
}

export function ImageDropzone({ value, onChange, folder = 'specials' }: ImageDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useImageUpload();

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = await upload(file, folder);
    if (url) onChange(url);
  }, [upload, folder, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  if (value) {
    return (
      <div className="relative group rounded-lg overflow-hidden border border-border">
        <img src={value} alt="Upload preview" className="w-full h-48 object-cover" />
        <button
          onClick={() => onChange(null)}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors ${
          dragOver ? 'border-primary bg-primary-50' : 'border-border hover:border-primary/50 hover:bg-surface-hover'
        }`}
      >
        {uploading ? (
          <Loader2 size={24} className="animate-spin text-primary" />
        ) : (
          <Upload size={24} className="text-text-muted" />
        )}
        <p className="text-sm text-text-muted">
          {uploading ? 'Uploading...' : 'Drop image here or click to browse'}
        </p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </>
  );
}
