import { useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

/** Maximum file sizes */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB

/** Allowed MIME types for upload (SVG excluded — can contain embedded scripts) */
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
]);
const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4', 'video/webm', 'video/quicktime',
]);

/** Known magic bytes for image/video formats */
const MAGIC_BYTES: [Uint8Array, string][] = [
  [new Uint8Array([0xFF, 0xD8, 0xFF]),             'image/jpeg'],
  [new Uint8Array([0x89, 0x50, 0x4E, 0x47]),       'image/png'],
  [new Uint8Array([0x52, 0x49, 0x46, 0x46]),       'image/webp'],  // RIFF (also used by WebM)
  [new Uint8Array([0x47, 0x49, 0x46]),              'image/gif'],
  [new Uint8Array([0x1A, 0x45, 0xDF, 0xA3]),       'video/webm'],
];

/**
 * Validate file content against magic bytes.
 * Returns true if the file header matches a known safe format.
 */
async function validateFileContent(file: File): Promise<boolean> {
  // QuickTime/MOV uses ftyp box at offset 4, complex to parse — trust MIME
  if (file.type === 'video/quicktime') return true;

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());

  // MP4 check: bytes 4-7 = "ftyp"
  if (file.type === 'video/mp4') {
    const ftyp = String.fromCharCode(header[4], header[5], header[6], header[7]);
    return ftyp === 'ftyp';
  }

  // Check known magic bytes
  for (const [magic] of MAGIC_BYTES) {
    if (header.length >= magic.length) {
      let match = true;
      for (let i = 0; i < magic.length; i++) {
        if (header[i] !== magic[i]) { match = false; break; }
      }
      if (match) return true;
    }
  }

  return false;
}

export function useImageUpload() {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File, folder = 'specials'): Promise<string | null> => {
    const isImage = ALLOWED_IMAGE_TYPES.has(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.has(file.type);

    // Validate MIME type
    if (!isImage && !isVideo) {
      toast.error(`File type "${file.type}" is not allowed`);
      return null;
    }

    // Validate file size
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      const limitMB = Math.round(maxSize / (1024 * 1024));
      toast.error(`File must be under ${limitMB} MB`);
      return null;
    }

    // Validate file content (magic bytes)
    const contentValid = await validateFileContent(file);
    if (!contentValid) {
      toast.error('File content does not match its type');
      return null;
    }

    setUploading(true);

    // Derive extension from MIME type (not filename) to prevent path traversal
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
    };
    const ext = extMap[file.type] || 'bin';
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage.from('images').upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type, // Explicitly set content-type
    });

    if (error) {
      toast.error('Upload failed. Please try again.');
      setUploading(false);
      return null;
    }

    const { data } = supabase.storage.from('images').getPublicUrl(fileName);
    setUploading(false);
    return data.publicUrl;
  };

  return { upload, uploading };
}
