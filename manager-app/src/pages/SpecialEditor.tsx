import { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Undo2, Redo2, Download, Save, Upload, RectangleVertical, RectangleHorizontal, Square,
  Loader2, Image, Sliders, ZoomIn, ZoomOut, Maximize,
  LayoutTemplate, Ruler, Sparkles, Type, Globe, Instagram
} from 'lucide-react';
import toast from 'react-hot-toast';
import { DomCanvas, type DomCanvasHandle } from '../components/editor/DomCanvas';
import { PropertyPanel } from '../components/editor/PropertyPanel';
import { LayerPanel } from '../components/editor/LayerPanel';
import { ImageLibrary } from '../components/editor/ImageLibrary';
import { ImageAdjustments } from '../components/editor/ImageAdjustments';
import { MobileToolbar } from '../components/editor/MobileToolbar';
import { MobileFilterBar } from '../components/editor/MobileFilterBar';
import { MobileFontPicker } from '../components/editor/MobileFontPicker';
import { MobileBlendPicker } from '../components/editor/MobileBlendPicker';
import { BottomSheet } from '../components/ui/BottomSheet';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { useEditorState } from '../hooks/useEditorState';
import { useImageUpload } from '../hooks/useImageUpload';
import { useSupabaseCRUD } from '../hooks/useSupabaseCRUD';
import { useDraftPersistence } from '../hooks/useDraftPersistence';
import { TEMPLATES } from '../data/templates';
import type { Special, TextLayer, UserTemplate } from '../types';
import { DEFAULT_IMAGE_FILTERS } from '../types';
import { VideoRefProvider } from '../context/VideoRefContext';
import { storeMedia, generateMediaId, makeIdbRef } from '../lib/mediaStore';
import { useMediaSync } from '../hooks/useMediaSync';
import { exportToGif } from '../components/editor/exportToGif';
import { ExportProgressModal } from '../components/editor/ExportProgressModal';
import { GradientPicker } from '../components/editor/GradientPicker';
import { TEXT_PRESETS } from '../components/editor/editorConstants';
import { findContrastIssues } from '../utils/colorContrast';

type RightTab = 'properties' | 'adjustments';
type MobileSheet = 'layers' | 'properties' | 'adjustments' | 'templates' | null;

export function SpecialEditor() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const canvasRef = useRef<DomCanvasHandle>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const imageLayerInputRef = useRef<HTMLInputElement>(null);
  const presetsButtonRef = useRef<HTMLButtonElement>(null);

  const { state, selectedLayer, canUndo, canRedo, dispatch, addTextLayer } = useEditorState();
  const { upload, uploading } = useImageUpload();
  const { data: specials, create, update } = useSupabaseCRUD<Special>('specials');
  const { data: userTemplates, create: createTemplate, remove: removeTemplate } = useSupabaseCRUD<UserTemplate>('user_templates');
  const { syncToSupabase } = useMediaSync();
  // No more CSS-transform zoom wrapper — canvas handles its own scale internally.

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryMode, setLibraryMode] = useState<'background' | 'layer'>('background');
  const [rightTab, setRightTab] = useState<RightTab>('properties');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null);
  const [zoom, setZoom] = useState<number | undefined>(undefined); // undefined = auto-fit
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [gradientPickerOpen, setGradientPickerOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg'>('png');
  const [exportQuality, setExportQuality] = useState(92);
  const [currentScale, setCurrentScale] = useState(1);
  // GIF export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);
  const [isGesturing, setIsGesturing] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileFontPickerOpen, setMobileFontPickerOpen] = useState(false);
  const [mobileBlendPickerOpen, setMobileBlendPickerOpen] = useState(false);

  // Close all floating overlays and bottom sheets — ensures only one is open at a time
  const closeAllOverlays = useCallback(() => {
    setMobileSheet(null);
    setMobileFontPickerOpen(false);
    setMobileBlendPickerOpen(false);
    setMobileFiltersOpen(false);
  }, []);

  const handleAlignCenterH = useCallback(() => {
    if (!state.selectedLayerId) return;
    const layer = state.layers.find(l => l.id === state.selectedLayerId);
    if (!layer) return;
    dispatch({ type: 'UPDATE_LAYER', id: layer.id, changes: { x: Math.round((state.canvasWidth - layer.width) / 2) } });
  }, [state.selectedLayerId, state.layers, state.canvasWidth, dispatch]);

  const handleAlignCenterV = useCallback(() => {
    if (!state.selectedLayerId) return;
    const layer = state.layers.find(l => l.id === state.selectedLayerId);
    if (!layer) return;
    const estimatedHeight = layer.imageHeight ?? Math.round(layer.fontSize * (layer.lineHeight || 1.3));
    dispatch({ type: 'UPDATE_LAYER', id: layer.id, changes: { y: Math.round((state.canvasHeight - estimatedHeight) / 2) } });
  }, [state.selectedLayerId, state.layers, state.canvasHeight, dispatch]);

  const [customSizeOpen, setCustomSizeOpen] = useState(false);
  const [customWidth, setCustomWidth] = useState(1080);
  const [customHeight, setCustomHeight] = useState(1080);
  const customSizeRef = useRef<HTMLButtonElement>(null);
  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', category: 'drink' });
  const [deleteTemplateId, setDeleteTemplateId] = useState<number | null>(null);
  const [saveForm, setSaveForm] = useState({
    title: '',
    description: '',
    type: 'drink' as 'drink' | 'food' | 'seasonal',
    price: '',
  });
  const [publishOptions, setPublishOptions] = useState({
    postToWebsite: true,
    shareToInstagram: false,
  });

  const isEdit = Boolean(id);

  // Draft persistence
  const { loadDraft, clearDraft, hasDraft } = useDraftPersistence(id, state, saveForm);

  // Warn on browser close/refresh with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  // Mark unsaved changes only after user interaction (not template/draft load)
  const initialStateRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.layers.length === 0 && !state.backgroundImage) return;
    const snapshot = JSON.stringify({ layers: state.layers, bg: state.backgroundImage, bgColor: state.backgroundColor, grad: state.backgroundGradient });
    if (initialStateRef.current === null) {
      // First meaningful state — save as baseline (template or draft load)
      initialStateRef.current = snapshot;
    } else if (snapshot !== initialStateRef.current) {
      setHasUnsavedChanges(true);
    }
  }, [state]);

  // Load draft on mount (ref guard prevents StrictMode double-fire)
  const draftPromptShown = useRef(false);
  useEffect(() => {
    if (draftPromptShown.current) return;
    if (!hasDraft()) return;

    draftPromptShown.current = true;

    // loadDraft is async (resolves idb:// media refs from IndexedDB)
    loadDraft().then((draft) => {
      if (!draft) return;
      toast((t) => (
        <div className="flex items-center gap-3">
          <span className="text-sm">Resume your draft?</span>
          <button
            onClick={() => {
              const editorState = {
                ...draft.editorState,
                imageFilters: draft.editorState.imageFilters || { ...DEFAULT_IMAGE_FILTERS },
              };
              dispatch({ type: 'LOAD_STATE', state: editorState });
              setSaveForm(draft.saveForm);
              toast.dismiss(t.id);
            }}
            className="px-3 py-1 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover"
          >
            Restore
          </button>
          <button
            onClick={() => {
              clearDraft();
              toast.dismiss(t.id);
            }}
            className="px-3 py-1 text-xs font-medium bg-surface-hover text-text-secondary rounded-lg hover:bg-surface-active"
          >
            Discard
          </button>
        </div>
      ), { duration: 10000 });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load template on mount
  useEffect(() => {
    const templateId = searchParams.get('template');
    if (templateId) {
      const template = TEMPLATES.find((t) => t.id === templateId);
      if (template) {
        dispatch({
          type: 'LOAD_STATE',
          state: {
            backgroundImage: null,
            backgroundColor: template.backgroundColor,
            backgroundGradient: template.backgroundGradient,
            imageFilters: { ...DEFAULT_IMAGE_FILTERS },
            layers: template.defaultLayers.map((l) => ({ ...l, id: crypto.randomUUID(), locked: false, visible: true })),
            selectedLayerId: null,
            canvasWidth: template.canvasWidth,
            canvasHeight: template.canvasHeight,
          },
        });
      }
    }
  }, [searchParams, dispatch]);

  // Load existing special for editing
  useEffect(() => {
    if (isEdit && specials.length > 0) {
      const special = specials.find((s) => s.id === Number(id));
      if (special) {
        setSaveForm({
          title: special.title,
          description: special.description,
          type: special.type,
          price: special.price ?? '',
        });
        if (special.image_url) {
          dispatch({ type: 'SET_BACKGROUND', url: special.image_url });
        }
      }
    }
  }, [isEdit, id, specials, dispatch]);

  const handleBgUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (don't trust accept= attribute alone)
    if (!file.type.startsWith('image/')) {
      toast.error('Background must be an image file');
      if (bgInputRef.current) bgInputRef.current.value = '';
      return;
    }
    // Enforce 10 MB size limit
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10 MB');
      if (bgInputRef.current) bgInputRef.current.value = '';
      return;
    }

    const url = await upload(file, 'editor-bg');
    if (url) {
      dispatch({ type: 'SET_BACKGROUND', url });
      toast.success('Background uploaded!');
    }
    if (bgInputRef.current) bgInputRef.current.value = '';
  }, [upload, dispatch]);

  const handleLibrarySelect = useCallback((url: string) => {
    if (libraryMode === 'layer') {
      // Insert as a movable image layer — need to get dimensions first
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const ratio = img.naturalHeight / img.naturalWidth;
        let layerWidth = Math.min(img.naturalWidth, state.canvasWidth * 0.8);
        let layerHeight = layerWidth * ratio;
        if (layerHeight > state.canvasHeight * 0.8) {
          layerHeight = state.canvasHeight * 0.8;
          layerWidth = layerHeight / ratio;
        }
        layerWidth = Math.round(layerWidth);
        layerHeight = Math.round(layerHeight);
        addTextLayer({
          elementType: 'image',
          text: url.split('/').pop() || 'Image',
          imageSrc: url,
          imageHeight: layerHeight,
          width: layerWidth,
          fontSize: 16,
        });
        toast.success('Image layer added');
      };
      img.onerror = () => {
        toast.error('Failed to load image');
      };
      img.src = url;
    } else {
      dispatch({ type: 'SET_BACKGROUND', url });
      toast.success('Background set from library');
    }
  }, [libraryMode, dispatch, addTextLayer, state.canvasWidth, state.canvasHeight]);

  /** Convert background image into a full image layer (move, resize, blend, etc.) */
  const handleConvertBgToLayer = useCallback(() => {
    const bgUrl = state.backgroundImage;
    if (!bgUrl) return;

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Calculate dimensions to cover the canvas
      const imgRatio = img.naturalWidth / img.naturalHeight;
      const canvasRatio = state.canvasWidth / state.canvasHeight;
      let layerWidth: number, layerHeight: number;
      if (imgRatio > canvasRatio) {
        // Image is wider — fit height, overflow width
        layerHeight = state.canvasHeight;
        layerWidth = Math.round(layerHeight * imgRatio);
      } else {
        // Image is taller — fit width, overflow height
        layerWidth = state.canvasWidth;
        layerHeight = Math.round(layerWidth / imgRatio);
      }

      // Center within canvas
      const x = Math.round((state.canvasWidth - layerWidth) / 2);
      const y = Math.round((state.canvasHeight - layerHeight) / 2);

      // Transfer current background filters to the new layer
      const currentFilters = { ...state.imageFilters };

      addTextLayer({
        elementType: 'image',
        text: bgUrl.split('/').pop() || 'Background',
        imageSrc: bgUrl,
        imageHeight: layerHeight,
        width: layerWidth,
        fontSize: 16,
        x,
        y,
        imageFilters: currentFilters,
      });

      // Clear background & reset filters
      dispatch({ type: 'SET_BACKGROUND', url: null });
      dispatch({ type: 'RESET_IMAGE_FILTERS' });
      toast.success('Background converted to layer — move, resize, and blend it!');
    };
    img.onerror = () => toast.error('Failed to load background image');
    img.src = bgUrl;
  }, [state.backgroundImage, state.canvasWidth, state.canvasHeight, state.imageFilters, addTextLayer, dispatch]);

  /** Fit an image/video layer to fill the canvas (triggered by triple-tap) */
  const handleFitLayerToCanvas = useCallback((layerId: string) => {
    const layer = state.layers.find(l => l.id === layerId);
    if (!layer || (layer.elementType !== 'image' && layer.elementType !== 'video')) return;

    const src = layer.imageSrc || layer.videoSrc;
    if (!src) return;

    // For images, get natural dimensions; for videos, use current aspect ratio
    if (layer.elementType === 'image') {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const imgRatio = img.naturalWidth / img.naturalHeight;
        const canvasRatio = state.canvasWidth / state.canvasHeight;
        let w: number, h: number;
        if (imgRatio > canvasRatio) {
          h = state.canvasHeight;
          w = Math.round(h * imgRatio);
        } else {
          w = state.canvasWidth;
          h = Math.round(w / imgRatio);
        }
        const x = Math.round((state.canvasWidth - w) / 2);
        const y = Math.round((state.canvasHeight - h) / 2);
        dispatch({ type: 'UPDATE_LAYER', id: layerId, changes: { width: w, imageHeight: h, x, y } });
        toast.success('Fit to canvas');
        if ('vibrate' in navigator) navigator.vibrate([15, 30, 15]);
      };
      img.src = src;
    } else {
      // Video: use current aspect ratio
      const currentH = layer.imageHeight || layer.width;
      const ratio = layer.width / currentH;
      const canvasRatio = state.canvasWidth / state.canvasHeight;
      let w: number, h: number;
      if (ratio > canvasRatio) {
        h = state.canvasHeight;
        w = Math.round(h * ratio);
      } else {
        w = state.canvasWidth;
        h = Math.round(w / ratio);
      }
      const x = Math.round((state.canvasWidth - w) / 2);
      const y = Math.round((state.canvasHeight - h) / 2);
      dispatch({ type: 'UPDATE_LAYER', id: layerId, changes: { width: w, imageHeight: h, x, y } });
      toast.success('Fit to canvas');
      if ('vibrate' in navigator) navigator.vibrate([15, 30, 15]);
    }
  }, [state.layers, state.canvasWidth, state.canvasHeight, dispatch]);

  const handleExport = useCallback(async (format: 'png' | 'jpeg' = 'png', quality = 92) => {
    dispatch({ type: 'SELECT_LAYER', id: null });

    // Wait for deselection render
    await new Promise((r) => setTimeout(r, 100));

    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const dataUrl = canvasRef.current?.exportImage(mimeType, quality / 100);
    if (!dataUrl) return;

    // Convert data URL to blob
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], `iggy-special-${Date.now()}.${ext}`, { type: mimeType });

    // Use Web Share API on mobile (iOS Safari ignores <a download>)
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        toast.success(`Image ready to save!`);
      } catch {
        // User cancelled share sheet — not an error
      }
      return;
    }

    // Desktop fallback: <a download> works on Chrome/Firefox/Edge
    const link = document.createElement('a');
    link.download = file.name;
    link.href = dataUrl;
    link.click();
    toast.success(`Image exported as ${ext.toUpperCase()}!`);
  }, [dispatch]);

  const handleExportGif = useCallback(async () => {
    const refs = canvasRef.current?.getVideoRefs();
    if (!refs) return;

    dispatch({ type: 'SELECT_LAYER', id: null });
    setExportModalOpen(false);
    setIsExporting(true);
    setExportProgress(0);
    setExportedBlob(null);

    const abort = new AbortController();
    exportAbortRef.current = abort;

    try {
      const blob = await exportToGif(state, refs, {
        fps: 15,
        onProgress: setExportProgress,
        abortSignal: abort.signal,
      });
      setExportedBlob(blob);
      setExportProgress(1);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        toast.error('GIF export failed');
        console.error('[exportGif]', e);
      }
      setIsExporting(false);
    }
  }, [state, dispatch]);

  const handleSave = async () => {
    setSaving(true);

    try {
      dispatch({ type: 'SELECT_LAYER', id: null });
      await new Promise((r) => setTimeout(r, 150));

      const dataUrl = canvasRef.current?.exportImage();
      let imageUrl: string | null = null;
      let imageFile: File | null = null;

      if (dataUrl) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        imageFile = new File([blob], `iggy-special-${Date.now()}.png`, { type: 'image/png' });
        imageUrl = await upload(imageFile, 'specials');
      }

      const payload = {
        title: saveForm.title,
        description: saveForm.description,
        type: saveForm.type,
        price: saveForm.price || null,
        image_url: imageUrl,
        active: publishOptions.postToWebsite,
      };

      const ok = isEdit
        ? await update(Number(id), payload)
        : await create(payload as Omit<Special, 'id' | 'created_at'>);

      if (ok) {
        // Toast feedback
        const actions: string[] = [];
        if (publishOptions.postToWebsite) actions.push('posted to website');
        if (publishOptions.shareToInstagram) actions.push('sharing to Instagram');
        toast.success(actions.length > 0
          ? `Special saved & ${actions.join(' & ')}!`
          : 'Special saved!');

        // Instagram share: open native share sheet (or download on desktop)
        if (publishOptions.shareToInstagram && imageFile) {
          if (navigator.share && navigator.canShare?.({ files: [imageFile] })) {
            try {
              await navigator.share({ files: [imageFile] });
            } catch {
              // User cancelled share — that's fine, special is already saved
            }
          } else if (dataUrl) {
            // Desktop fallback: download the image
            const link = document.createElement('a');
            link.download = imageFile.name;
            link.href = dataUrl;
            link.click();
            toast.success('Image downloaded for Instagram!');
          }
        }

        clearDraft();
        setHasUnsavedChanges(false);
        setSaveModalOpen(false);
        navigate('/specials');
      }
    } catch (error) {
      console.error('[handleSave]', error);
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Add image or video layer from file — stores in IndexedDB for persistence
  const handleAddMediaLayer = useCallback(async (file: File) => {
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isImage && !isVideo) {
      toast.error('Unsupported file type. Use an image or video.');
      return;
    }
    if (isVideo && file.size > 50 * 1024 * 1024) {
      toast.error('Video must be under 50 MB');
      return;
    }
    if (isImage && file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10 MB');
      return;
    }

    // Store blob in IndexedDB and get a persistent reference
    const mediaId = generateMediaId();
    const idbRef = makeIdbRef(mediaId);

    await storeMedia(mediaId, file, {
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      createdAt: new Date().toISOString(),
    });

    if (isVideo) {
      // Read video dimensions/duration + capture poster frame
      const blobUrl = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.src = blobUrl;

      video.onloadedmetadata = () => {
        const naturalW = video.videoWidth;
        const naturalH = video.videoHeight;
        const ratio = naturalH / naturalW;
        let layerWidth = Math.min(naturalW, state.canvasWidth * 0.8);
        let layerHeight = layerWidth * ratio;
        if (layerHeight > state.canvasHeight * 0.8) {
          layerHeight = state.canvasHeight * 0.8;
          layerWidth = layerHeight / ratio;
        }
        layerWidth = Math.round(layerWidth);
        layerHeight = Math.round(layerHeight);

        // Seek to capture a poster frame
        video.currentTime = 0.1;
        video.onseeked = () => {
          let posterSrc: string | undefined;
          try {
            const c = document.createElement('canvas');
            c.width = Math.min(naturalW, 400);
            c.height = Math.round(c.width * ratio);
            const ctx = c.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, c.width, c.height);
              posterSrc = c.toDataURL('image/jpeg', 0.7);
            }
          } catch { /* poster capture failed — non-critical */ }

          addTextLayer({
            elementType: 'video',
            text: file.name,
            videoSrc: idbRef, // idb:// ref — VideoElement resolves to blob URL
            videoPosterSrc: posterSrc,
            videoDuration: video.duration,
            videoMuted: true,
            videoLoop: true,
            imageHeight: layerHeight,
            width: layerWidth,
            fontSize: 16,
          });

          URL.revokeObjectURL(blobUrl);
          video.remove();
        };
      };
    } else {
      // Image path — read dimensions, store idb:// ref
      const blobUrl = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        const ratio = img.naturalHeight / img.naturalWidth;
        let layerWidth = Math.min(img.naturalWidth, state.canvasWidth * 0.8);
        let layerHeight = layerWidth * ratio;
        if (layerHeight > state.canvasHeight * 0.8) {
          layerHeight = state.canvasHeight * 0.8;
          layerWidth = layerHeight / ratio;
        }
        layerWidth = Math.round(layerWidth);
        layerHeight = Math.round(layerHeight);

        addTextLayer({
          elementType: 'image',
          text: file.name,
          imageSrc: idbRef, // idb:// ref — ImageElement will need resolution
          imageHeight: layerHeight,
          width: layerWidth,
          fontSize: 16,
        });

        URL.revokeObjectURL(blobUrl);
      };
      img.src = blobUrl;
    }

    // Background Supabase upload (fire and forget)
    syncToSupabase(idbRef, isVideo ? 'media/video' : 'media/image');
  }, [state.canvasWidth, state.canvasHeight, addTextLayer, syncToSupabase]);

  const handleDuplicate = useCallback((layer: TextLayer) => {
    const { id: _id, ...rest } = layer;
    addTextLayer({
      ...rest,
      x: layer.x + 20,
      y: layer.y + 20,
    });
  }, [addTextLayer]);

  // Back navigation with unsaved changes guard
  const handleBack = useCallback(() => {
    if (hasUnsavedChanges) {
      setLeaveConfirmOpen(true);
    } else {
      navigate('/specials');
    }
  }, [hasUnsavedChanges, navigate]);

  // Apply gradient and check text contrast
  const handleGradientSelect = useCallback((gradient: string | undefined) => {
    dispatch({ type: 'SET_BACKGROUND_GRADIENT', gradient });
    if (!gradient) return;

    const issues = findContrastIssues(
      gradient,
      state.layers.map((l) => ({ id: l.id, y: l.y, fill: l.fill, elementType: l.elementType })),
      state.canvasHeight,
    );

    if (issues.length > 0) {
      toast(
        (t) => (
          <div className="flex items-center gap-3">
            <span className="text-sm">{issues.length} text layer{issues.length > 1 ? 's' : ''} may be hard to read</span>
            <button
              onClick={() => {
                issues.forEach((issue) => {
                  dispatch({ type: 'UPDATE_LAYER', id: issue.layerId, changes: { fill: issue.suggestedColor } });
                });
                toast.dismiss(t.id);
                toast.success('Text colors updated');
              }}
              className="shrink-0 px-2.5 py-1 rounded-md bg-primary text-white text-xs font-medium"
            >
              Auto-fix
            </button>
          </div>
        ),
        { duration: 6000 },
      );
    }
  }, [dispatch, state.layers, state.canvasHeight]);

  // Load a template into the editor
  const loadTemplate = useCallback((templateId: string) => {
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    dispatch({
      type: 'LOAD_STATE',
      state: {
        backgroundImage: null,
        backgroundColor: template.backgroundColor,
        backgroundGradient: template.backgroundGradient,
        imageFilters: { ...DEFAULT_IMAGE_FILTERS },
        layers: template.defaultLayers.map((l) => ({ ...l, id: crypto.randomUUID(), locked: false, visible: true })),
        selectedLayerId: null,
        canvasWidth: template.canvasWidth,
        canvasHeight: template.canvasHeight,
      },
    });
    setTemplatePickerOpen(false);
    toast.success(`Loaded "${template.name}" template`);
  }, [dispatch]);

  const loadUserTemplate = useCallback((template: UserTemplate) => {
    dispatch({
      type: 'LOAD_STATE',
      state: {
        backgroundImage: null,
        backgroundColor: template.background_color,
        backgroundGradient: template.background_gradient ?? undefined,
        imageFilters: { ...DEFAULT_IMAGE_FILTERS },
        layers: template.layers.map((l) => ({ ...l, id: crypto.randomUUID(), locked: false, visible: true })),
        selectedLayerId: null,
        canvasWidth: template.canvas_width,
        canvasHeight: template.canvas_height,
      },
    });
    setTemplatePickerOpen(false);
    setMobileSheet(null);
    toast.success(`Loaded "${template.name}" template`);
  }, [dispatch]);

  const handleSaveAsTemplate = useCallback(async () => {
    if (!templateForm.name.trim()) return;
    setSavingTemplate(true);
    dispatch({ type: 'SELECT_LAYER', id: null });
    await new Promise((r) => setTimeout(r, 150));

    // Export and downscale thumbnail
    const fullDataUrl = canvasRef.current?.exportImage('image/jpeg', 0.7);
    let thumbnailUrl: string | null = null;
    if (fullDataUrl) {
      try {
        const img = new window.Image();
        img.src = fullDataUrl;
        await new Promise((resolve) => { img.onload = resolve; });
        const thumbCanvas = document.createElement('canvas');
        const thumbWidth = 300;
        const thumbHeight = Math.round((img.height / img.width) * thumbWidth);
        thumbCanvas.width = thumbWidth;
        thumbCanvas.height = thumbHeight;
        const ctx = thumbCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, thumbWidth, thumbHeight);
          const blob = await new Promise<Blob | null>((resolve) => thumbCanvas.toBlob(resolve, 'image/jpeg', 0.8));
          if (blob) {
            const file = new File([blob], `template-${Date.now()}.jpg`, { type: 'image/jpeg' });
            thumbnailUrl = await upload(file, 'templates');
          }
        }
      } catch { /* thumbnail is optional, continue without it */ }
    }

    // Strip IDs from layers for storage
    const layersForStorage = state.layers.map(({ id: _id, ...rest }) => rest);

    const ok = await createTemplate({
      name: templateForm.name.trim(),
      category: templateForm.category,
      canvas_width: state.canvasWidth,
      canvas_height: state.canvasHeight,
      background_color: state.backgroundColor,
      background_gradient: state.backgroundGradient ?? null,
      layers: layersForStorage,
      thumbnail_url: thumbnailUrl,
    } as Omit<UserTemplate, 'id' | 'created_at'>);

    setSavingTemplate(false);
    if (ok) {
      setSaveTemplateModalOpen(false);
      setTemplateForm({ name: '', category: 'drink' });
    }
  }, [templateForm, state, dispatch, upload, createTemplate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.target instanceof HTMLElement && e.target.isContentEditable) return;

      const mod = e.metaKey || e.ctrlKey;

      // Cmd+Z / Cmd+Shift+Z — Undo / Redo
      if (mod && e.key === 'z') {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'REDO' : 'UNDO' });
        return;
      }

      // Cmd+S — Save (open modal)
      if (mod && e.key === 's') {
        e.preventDefault();
        setSaveModalOpen(true);
        return;
      }

      // Cmd+D — Duplicate selected layer
      if (mod && e.key === 'd') {
        e.preventDefault();
        if (selectedLayer) {
          handleDuplicate(selectedLayer);
          toast.success('Layer duplicated');
        }
        return;
      }

      // Delete / Backspace — Remove selected (unlocked) layer
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedLayerId) {
          const layer = state.layers.find(l => l.id === state.selectedLayerId);
          if (layer && !layer.locked) {
            dispatch({ type: 'REMOVE_LAYER', id: state.selectedLayerId });
          }
        }
        return;
      }

      // Arrow keys — Nudge selected layer (1px, or 10px with Shift)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (state.selectedLayerId) {
          const layer = state.layers.find(l => l.id === state.selectedLayerId);
          if (layer && !layer.locked) {
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;
            const changes: Partial<TextLayer> = {};
            if (e.key === 'ArrowUp') changes.y = layer.y - step;
            if (e.key === 'ArrowDown') changes.y = layer.y + step;
            if (e.key === 'ArrowLeft') changes.x = layer.x - step;
            if (e.key === 'ArrowRight') changes.x = layer.x + step;
            dispatch({ type: 'UPDATE_LAYER', id: state.selectedLayerId, changes });
          }
        }
        return;
      }

      // Escape — Deselect
      if (e.key === 'Escape') {
        dispatch({ type: 'SELECT_LAYER', id: null });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch, state.selectedLayerId, state.layers, selectedLayer, handleDuplicate]);

  // Hide the main app nav header on mobile when editor is open
  useEffect(() => {
    const navBar = document.querySelector('.lg\\:hidden.fixed.top-0') as HTMLElement;
    if (navBar) navBar.style.display = 'none';
    return () => {
      if (navBar) navBar.style.display = '';
    };
  }, []);

  return (
    <VideoRefProvider>
    <div className="md:h-[calc(100vh-3rem)] md:-m-6 lg:-m-8 md:relative md:flex md:flex-col fixed inset-0 z-50 flex flex-col bg-background">
      {/* Desktop Toolbar — hidden on mobile (MobileToolbar handles it) */}
      <div className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-surface border-b border-border shrink-0 overflow-x-auto">
        <button onClick={handleBack} className="btn-ghost text-xs py-1.5 px-2" aria-label="Back to specials">
          <ArrowLeft size={16} />
        </button>
        <div className="w-px h-6 bg-border" />

        {/* Text Tools */}
        <button onClick={() => addTextLayer()} className="btn-secondary text-xs py-1.5 px-3">
          <Plus size={14} /> Text
        </button>

        {/* Text Presets dropdown — uses portal to escape toolbar overflow clipping */}
        <button
          ref={presetsButtonRef}
          className="btn-secondary text-xs py-1.5 px-3"
          onClick={() => setPresetsOpen(!presetsOpen)}
        >
          <Type size={14} /> Presets
        </button>
        {presetsOpen && createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPresetsOpen(false)} />
            <div
              className="fixed z-50 bg-surface border border-border rounded-lg shadow-modal p-1.5 min-w-[140px]"
              style={(() => {
                const rect = presetsButtonRef.current?.getBoundingClientRect();
                return rect ? { top: rect.bottom + 4, left: rect.left } : {};
              })()}
            >
              {TEXT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    addTextLayer(preset.overrides as Partial<TextLayer>);
                    setPresetsOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-secondary hover:bg-surface-hover rounded-md transition-colors"
                >
                  <preset.icon size={13} />
                  {preset.label}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}

        <button
          onClick={() => setTemplatePickerOpen(!templatePickerOpen)}
          className="btn-secondary text-xs py-1.5 px-3"
          title="Start from a template"
        >
          <LayoutTemplate size={14} /> Templates
        </button>

        <div className="w-px h-6 bg-border" />

        {/* Background Tools */}
        <button onClick={() => setLibraryOpen(true)} className="btn-secondary text-xs py-1.5 px-3">
          <Image size={14} /> Library
        </button>
        <button onClick={() => bgInputRef.current?.click()} className="btn-secondary text-xs py-1.5 px-3" disabled={uploading}>
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload
        </button>
        <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
        <input ref={imageLayerInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleAddMediaLayer(file);
          if (imageLayerInputRef.current) imageLayerInputRef.current.value = '';
        }} />

        <div className="w-px h-6 bg-border" />

        {/* Canvas size */}
        <button
          onClick={() => dispatch({ type: 'SET_CANVAS_SIZE', width: 1080, height: 1080 })}
          className={`p-2 rounded-lg transition-colors ${state.canvasWidth === 1080 && state.canvasHeight === 1080 ? 'bg-primary text-white' : 'bg-surface-hover text-text-muted'}`}
          title="Square (1080×1080)"
          aria-label="Square canvas"
        >
          <Square size={16} />
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_CANVAS_SIZE', width: 1080, height: 1350 })}
          className={`p-2 rounded-lg transition-colors ${state.canvasWidth === 1080 && state.canvasHeight === 1350 ? 'bg-primary text-white' : 'bg-surface-hover text-text-muted'}`}
          title="Portrait (1080×1350)"
          aria-label="Portrait canvas"
        >
          <RectangleVertical size={16} />
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_CANVAS_SIZE', width: 1080, height: 1920 })}
          className={`p-2 rounded-lg transition-colors ${state.canvasWidth === 1080 && state.canvasHeight === 1920 ? 'bg-primary text-white' : 'bg-surface-hover text-text-muted'}`}
          title="Story (1080×1920)"
          aria-label="Story canvas"
        >
          <RectangleVertical size={16} className="scale-y-125" />
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_CANVAS_SIZE', width: 1920, height: 1080 })}
          className={`p-2 rounded-lg transition-colors ${state.canvasWidth === 1920 && state.canvasHeight === 1080 ? 'bg-primary text-white' : 'bg-surface-hover text-text-muted'}`}
          title="Landscape (1920×1080)"
          aria-label="Landscape canvas"
        >
          <RectangleHorizontal size={16} />
        </button>
        <button
          ref={customSizeRef}
          onClick={() => { setCustomWidth(state.canvasWidth); setCustomHeight(state.canvasHeight); setCustomSizeOpen(!customSizeOpen); }}
          className={`p-2 rounded-lg transition-colors ${![[1080,1080],[1080,1350],[1080,1920],[1920,1080]].some(([w,h]) => state.canvasWidth === w && state.canvasHeight === h) ? 'bg-primary text-white' : 'bg-surface-hover text-text-muted'}`}
          title={`Custom (${state.canvasWidth}×${state.canvasHeight})`}
          aria-label="Custom canvas size"
        >
          <Ruler size={16} />
        </button>
        {customSizeOpen && createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setCustomSizeOpen(false)} />
            <div
              className="fixed z-50 bg-surface border border-border rounded-lg shadow-modal p-3 w-56"
              style={(() => {
                const rect = customSizeRef.current?.getBoundingClientRect();
                return rect ? { top: rect.bottom + 4, left: rect.left } : {};
              })()}
            >
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Custom Size</h4>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="text-[13px] text-text-muted">Width</label>
                  <input
                    type="number"
                    min={256}
                    max={4096}
                    value={customWidth}
                    onChange={(e) => setCustomWidth(Number(e.target.value))}
                    className="input-field text-xs w-full"
                  />
                </div>
                <div>
                  <label className="text-[13px] text-text-muted">Height</label>
                  <input
                    type="number"
                    min={256}
                    max={4096}
                    value={customHeight}
                    onChange={(e) => setCustomHeight(Number(e.target.value))}
                    className="input-field text-xs w-full"
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  const w = Math.min(4096, Math.max(256, customWidth));
                  const h = Math.min(4096, Math.max(256, customHeight));
                  dispatch({ type: 'SET_CANVAS_SIZE', width: w, height: h });
                  setCustomSizeOpen(false);
                  toast.success(`Canvas set to ${w}×${h}`);
                }}
                className="btn-primary w-full text-xs"
              >
                Apply
              </button>
            </div>
          </>,
          document.body,
        )}

        <div className="w-px h-6 bg-border" />

        <button onClick={() => dispatch({ type: 'UNDO' })} disabled={!canUndo} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted disabled:opacity-30" title="Undo (Cmd+Z)" aria-label="Undo">
          <Undo2 size={16} />
        </button>
        <button onClick={() => dispatch({ type: 'REDO' })} disabled={!canRedo} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted disabled:opacity-30" title="Redo (Cmd+Shift+Z)" aria-label="Redo">
          <Redo2 size={16} />
        </button>

        <div className="w-px h-6 bg-border" />

        {/* Zoom controls */}
        <button
          onClick={() => setZoom(z => Math.max(0.25, (z ?? canvasRef.current?.getScale() ?? 0.5) - 0.1))}
          className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted"
          title="Zoom Out"
          aria-label="Zoom out"
        >
          <ZoomOut size={16} />
        </button>
        <span className="text-xs text-text-muted w-10 text-center tabular-nums" aria-label={`Zoom ${Math.round(currentScale * 100)}%`}>
          {Math.round(currentScale * 100)}%
        </span>
        <button
          onClick={() => setZoom(z => Math.min(2, (z ?? canvasRef.current?.getScale() ?? 0.5) + 0.1))}
          className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted"
          title="Zoom In"
          aria-label="Zoom in"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={() => setZoom(undefined)}
          className={`p-1.5 rounded-lg hover:bg-surface-hover transition-colors ${zoom === undefined ? 'text-primary' : 'text-text-muted'}`}
          title="Fit to Screen"
          aria-label="Fit to screen"
        >
          <Maximize size={16} />
        </button>

        <div className="flex-1" />

        {/* Background color + gradient */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted">BG:</span>
          <input
            type="color"
            value={state.backgroundColor}
            onChange={(e) => dispatch({ type: 'SET_BACKGROUND_COLOR', color: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer border border-border"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setGradientPickerOpen(!gradientPickerOpen)}
            className={`btn-ghost text-xs py-1.5 px-2 ${state.backgroundGradient ? 'text-primary' : ''}`}
            style={state.backgroundGradient ? { borderBottom: '2px solid #2dd4bf' } : undefined}
          >
            Gradient
          </button>
          {gradientPickerOpen && createPortal(
            <div
              className="fixed z-[999] bg-surface border border-border rounded-xl shadow-modal p-3 w-[340px] animate-fade-in"
              style={{ top: 52, right: 120 }}
            >
              <GradientPicker
                currentGradient={state.backgroundGradient}
                onSelect={handleGradientSelect}
              />
            </div>,
            document.body,
          )}
        </div>

        <div className="w-px h-6 bg-border" />

        <button onClick={() => setExportModalOpen(true)} className="btn-secondary text-xs py-1.5 px-3" aria-label="Export image">
          <Download size={14} /> Export
        </button>
        <button onClick={() => setSaveModalOpen(true)} className="btn-primary text-xs py-1.5 px-3">
          <Save size={14} /> Save
        </button>
      </div>

      {/* Mobile header — ultra-minimal, just back + title */}
      <div
        className="flex md:hidden items-center gap-3 px-3 py-1.5 shrink-0 bg-surface/90 backdrop-blur-xl border-b border-border/30"
        style={{
          opacity: isGesturing ? 0 : 1,
          transform: isGesturing ? 'translateY(-10px)' : 'translateY(0)',
          transition: 'opacity 200ms ease, transform 200ms ease',
          pointerEvents: isGesturing ? 'none' : 'auto',
        }}
      >
        <button onClick={handleBack} className="p-2 rounded-xl hover:bg-surface-hover active:scale-90 transition-all" aria-label="Back to specials">
          <ArrowLeft size={18} className="text-text-primary" />
        </button>
        <h2 className="text-sm font-semibold text-text-primary flex-1 truncate">
          {isEdit ? 'Edit Special' : 'New Special'}
        </h2>
      </div>

      {/* Editor Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Panel - Layers (desktop only, narrower at md, wider at lg) */}
        <div className="w-44 lg:w-56 bg-surface border-r border-border p-2 lg:p-3 overflow-y-auto hidden md:block">
          <LayerPanel
            layers={state.layers}
            selectedId={state.selectedLayerId}
            onSelect={(id) => dispatch({ type: 'SELECT_LAYER', id })}
            onReorder={(layers) => dispatch({ type: 'REORDER_LAYERS', layers })}
            onDelete={(id) => dispatch({ type: 'REMOVE_LAYER', id })}
            onDuplicate={handleDuplicate}
            onToggleVisibility={(id) => dispatch({ type: 'TOGGLE_LAYER_VISIBILITY', id })}
            onToggleLock={(id) => dispatch({ type: 'TOGGLE_LAYER_LOCK', id })}
          />
        </div>

        {/* Canvas Area — DOM-based canvas with gesture handling */}
        <div className="flex-1 bg-black/40 md:bg-surface-active overflow-hidden relative">
          <DomCanvas
            ref={canvasRef}
            state={state}
            onSelectLayer={(id) => dispatch({ type: 'SELECT_LAYER', id })}
            onUpdateLayer={(id, changes) => dispatch({ type: 'UPDATE_LAYER', id, changes })}
            zoomOverride={zoom}
            onScaleChange={setCurrentScale}
            onGestureChange={setIsGesturing}
            onLayerTapped={() => {
              // Don't auto-open properties on tap — let users drag freely.
              // Properties are auto-opened only when ADDING a new layer from presets.
            }}
            onTripleTap={handleFitLayerToCanvas}
          />

          {/* Empty canvas onboarding */}
          {state.layers.length === 0 && !state.backgroundImage && !state.backgroundGradient && state.backgroundColor === '#1a1a2e' && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="text-center pointer-events-auto">
                <Sparkles size={36} className="mx-auto text-text-muted mb-3" />
                <p className="text-sm text-text-secondary font-medium mb-1">Ready to create?</p>
                <button
                  onClick={() => setTemplatePickerOpen(true)}
                  className="btn-primary text-sm mt-3"
                >
                  <LayoutTemplate size={16} /> Start from a template
                </button>
                <p className="text-xs text-text-muted mt-3">or use the toolbar to start blank</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Properties / Adjustments (desktop only, narrower at md, wider at lg) */}
        <div className="w-60 lg:w-72 bg-surface border-l border-border flex-col hidden md:flex">
          {/* Tab switcher */}
          <div className="flex border-b border-border shrink-0">
            <button
              onClick={() => setRightTab('properties')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                rightTab === 'properties'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Type size={14} /> Properties
            </button>
            <button
              onClick={() => setRightTab('adjustments')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                rightTab === 'adjustments'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Sliders size={14} /> Adjust
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            {rightTab === 'properties' ? (
              selectedLayer ? (
                <PropertyPanel
                  layer={selectedLayer}
                  onUpdate={(changes) => dispatch({ type: 'UPDATE_LAYER', id: selectedLayer.id, changes })}
                  onDelete={() => dispatch({ type: 'REMOVE_LAYER', id: selectedLayer.id })}
                  canvasWidth={state.canvasWidth}
                  canvasHeight={state.canvasHeight}
                />
              ) : (
                <div className="text-center py-8">
                  <Type size={24} className="mx-auto text-text-muted mb-2" />
                  <p className="text-sm text-text-muted">Select a text layer to edit</p>
                  <p className="text-xs text-text-muted mt-1">or add one from the toolbar</p>
                </div>
              )
            ) : (
              <ImageAdjustments
                filters={state.imageFilters}
                hasBackground={!!state.backgroundImage}
                onUpdate={(filters) => dispatch({ type: 'SET_IMAGE_FILTERS', filters })}
                onReset={() => dispatch({ type: 'RESET_IMAGE_FILTERS' })}
                onConvertToLayer={state.backgroundImage ? handleConvertBgToLayer : undefined}
              />
            )}
          </div>
        </div>
      </div>

      {/* Mobile Toolbar — fixed at bottom */}
      <MobileToolbar
        onAddText={(overrides) => {
          closeAllOverlays();
          addTextLayer(overrides);
          setMobileSheet('properties');
        }}
        onAddImage={() => { closeAllOverlays(); imageLayerInputRef.current?.click(); }}
        onOpenLibrary={() => { closeAllOverlays(); setLibraryMode('background'); setLibraryOpen(true); }}
        onAddImageFromLibrary={() => { closeAllOverlays(); setLibraryMode('layer'); setLibraryOpen(true); }}
        onConvertBgToLayer={state.backgroundImage ? handleConvertBgToLayer : undefined}
        onFitToCanvas={selectedLayer && (selectedLayer.elementType === 'image' || selectedLayer.elementType === 'video') ? () => handleFitLayerToCanvas(selectedLayer.id) : undefined}
        onAlignCenterH={handleAlignCenterH}
        onAlignCenterV={handleAlignCenterV}
        onUpload={() => { closeAllOverlays(); bgInputRef.current?.click(); }}
        onOpenLayers={() => { closeAllOverlays(); setMobileSheet('layers'); }}
        onOpenProperties={() => { closeAllOverlays(); setMobileSheet('properties'); }}
        onOpenFontPicker={() => { closeAllOverlays(); setMobileFontPickerOpen(true); }}
        onOpenBlendPicker={() => { closeAllOverlays(); setMobileBlendPickerOpen(true); }}
        onCloseOverlays={closeAllOverlays}
        onOpenTemplates={() => { closeAllOverlays(); setMobileSheet('templates'); }}
        onUndo={() => dispatch({ type: 'UNDO' })}
        onRedo={() => dispatch({ type: 'REDO' })}
        onSave={() => setSaveModalOpen(true)}
        onExport={() => setExportModalOpen(true)}
        onSetCanvasSize={(w, h) => dispatch({ type: 'SET_CANVAS_SIZE', width: w, height: h })}
        onSetBgColor={(color) => dispatch({ type: 'SET_BACKGROUND_COLOR', color })}
        onSetGradient={handleGradientSelect}
        currentGradient={state.backgroundGradient}
        onDuplicate={selectedLayer ? () => handleDuplicate(selectedLayer) : undefined}
        canvasWidth={state.canvasWidth}
        canvasHeight={state.canvasHeight}
        bgColor={state.backgroundColor}
        canUndo={canUndo}
        canRedo={canRedo}
        uploading={uploading}
        hasSelection={!!selectedLayer}
        isImageSelected={selectedLayer?.elementType === 'image' || selectedLayer?.elementType === 'video'}
        activeSheet={mobileSheet}
        gestureActive={isGesturing}
      />

      {/* Mobile Bottom Sheets */}
      <BottomSheet
        open={mobileSheet === 'layers'}
        onClose={() => setMobileSheet(null)}
        title="Layers"
      >
        <LayerPanel
          layers={state.layers}
          selectedId={state.selectedLayerId}
          onSelect={(id) => dispatch({ type: 'SELECT_LAYER', id })}
          onReorder={(layers) => dispatch({ type: 'REORDER_LAYERS', layers })}
          onDelete={(id) => dispatch({ type: 'REMOVE_LAYER', id })}
          onDuplicate={handleDuplicate}
          onToggleVisibility={(id) => dispatch({ type: 'TOGGLE_LAYER_VISIBILITY', id })}
          onToggleLock={(id) => dispatch({ type: 'TOGGLE_LAYER_LOCK', id })}
        />
      </BottomSheet>

      <BottomSheet
        open={mobileSheet === 'properties'}
        onClose={() => setMobileSheet(null)}
        title={selectedLayer?.elementType === 'divider' ? 'Divider Properties' : (selectedLayer?.elementType === 'image' || selectedLayer?.elementType === 'video') ? 'Media Properties' : 'Text Properties'}
      >
        {selectedLayer ? (
          <PropertyPanel
            layer={selectedLayer}
            onUpdate={(changes) => dispatch({ type: 'UPDATE_LAYER', id: selectedLayer.id, changes })}
            onDelete={() => dispatch({ type: 'REMOVE_LAYER', id: selectedLayer.id })}
            canvasWidth={state.canvasWidth}
            canvasHeight={state.canvasHeight}
          />
        ) : (
          <div className="text-center py-8">
            <Type size={24} className="mx-auto text-text-muted mb-2" />
            <p className="text-sm text-text-muted">Select a text layer first</p>
          </div>
        )}
      </BottomSheet>

      {/* Mobile floating filter bar — overlays canvas for real-time preview */}
      {mobileFiltersOpen && (
        <MobileFilterBar
          filters={state.imageFilters}
          hasBackground={!!state.backgroundImage}
          onUpdate={(filters) => dispatch({ type: 'SET_IMAGE_FILTERS', filters })}
          onReset={() => dispatch({ type: 'RESET_IMAGE_FILTERS' })}
          onClose={() => setMobileFiltersOpen(false)}
        />
      )}

      {/* Mobile floating font picker — overlays canvas for real-time preview */}
      {mobileFontPickerOpen && selectedLayer && (
        <MobileFontPicker
          layer={selectedLayer}
          onUpdate={(changes) => dispatch({ type: 'UPDATE_LAYER', id: selectedLayer.id, changes })}
          onClose={() => setMobileFontPickerOpen(false)}
          elementScreenY={(() => {
            // Calculate where the selected element is on screen (0=top, 1=bottom)
            const canvasEl = document.querySelector('[data-layer-id="' + selectedLayer.id + '"]');
            if (canvasEl) {
              const rect = canvasEl.getBoundingClientRect();
              return (rect.top + rect.height / 2) / window.innerHeight;
            }
            return 0.5;
          })()}
        />
      )}

      {/* Mobile floating blend picker — overlays canvas for real-time preview */}
      {mobileBlendPickerOpen && selectedLayer && (selectedLayer.elementType === 'image' || selectedLayer.elementType === 'video') && (
        <MobileBlendPicker
          layer={selectedLayer}
          onUpdate={(changes) => dispatch({ type: 'UPDATE_LAYER', id: selectedLayer.id, changes })}
          onClose={() => setMobileBlendPickerOpen(false)}
          elementScreenY={(() => {
            const canvasEl = document.querySelector('[data-layer-id="' + selectedLayer.id + '"]');
            if (canvasEl) {
              const rect = canvasEl.getBoundingClientRect();
              return (rect.top + rect.height / 2) / window.innerHeight;
            }
            return 0.5;
          })()}
        />
      )}

      {/* Image Library Drawer */}
      <ImageLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelect={handleLibrarySelect}
      />

      {/* Leave confirmation */}
      <ConfirmDialog
        open={leaveConfirmOpen}
        onClose={() => setLeaveConfirmOpen(false)}
        onConfirm={() => navigate('/specials')}
        title="Unsaved Changes"
        message="You have unsaved changes. Your draft is auto-saved and you can resume later. Leave anyway?"
        confirmLabel="Leave"
        danger={false}
      />

      {/* Export Modal */}
      <Modal open={exportModalOpen} onClose={() => setExportModalOpen(false)} title="Export" maxWidth="max-w-sm">
        <div className="space-y-4">
          {/* GIF option — shown when video layers exist */}
          {state.layers.some(l => l.elementType === 'video') && (
            <button
              onClick={handleExportGif}
              className="w-full py-3 px-4 rounded-xl bg-surface-hover hover:bg-surface-active text-left transition-colors border border-border/30"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎬</span>
                <div>
                  <p className="text-sm font-medium text-text-primary">Animated GIF</p>
                  <p className="text-xs text-text-muted">Exports video layers as animated GIF</p>
                </div>
              </div>
            </button>
          )}

          {/* Static image export */}
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">
              {state.layers.some(l => l.elementType === 'video') ? 'Still Frame' : 'Format'}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setExportFormat('png')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${exportFormat === 'png' ? 'bg-primary text-white' : 'bg-surface-hover text-text-secondary hover:bg-surface-active'}`}
              >
                PNG
              </button>
              <button
                onClick={() => setExportFormat('jpeg')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${exportFormat === 'jpeg' ? 'bg-primary text-white' : 'bg-surface-hover text-text-secondary hover:bg-surface-active'}`}
              >
                JPEG
              </button>
            </div>
            {state.layers.some(l => l.elementType === 'video') && (
              <p className="text-[13px] text-text-muted mt-1">Captures the current video frame as a still image</p>
            )}
          </div>
          {exportFormat === 'jpeg' && (
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">Quality: {exportQuality}%</label>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={exportQuality}
                onChange={(e) => setExportQuality(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[12px] text-text-muted mt-0.5">
                <span>Smaller file</span>
                <span>Best quality</span>
              </div>
            </div>
          )}
          <button
            onClick={() => { handleExport(exportFormat, exportQuality); setExportModalOpen(false); }}
            className="btn-primary w-full"
          >
            <Download size={14} /> Download {exportFormat.toUpperCase()}
          </button>
        </div>
      </Modal>

      {/* GIF Export Progress */}
      {isExporting && (
        <ExportProgressModal
          progress={exportProgress}
          done={exportedBlob !== null}
          blob={exportedBlob}
          format="gif"
          onCancel={() => {
            exportAbortRef.current?.abort();
            setIsExporting(false);
            setExportedBlob(null);
          }}
          onClose={() => {
            setIsExporting(false);
            setExportedBlob(null);
          }}
        />
      )}

      {/* Template Picker — shared grid used in both Modal (desktop) and BottomSheet (mobile) */}
      {(() => {
        const templateGrid = (
          <>
            <p className="text-xs text-text-muted mb-3">This will replace your current canvas. Your draft is auto-saved.</p>

            {/* User templates */}
            {userTemplates.length > 0 && (
              <>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">My Templates</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {userTemplates.map((t) => (
                    <div key={t.id} className="relative group">
                      <button
                        onClick={() => loadUserTemplate(t)}
                        className="text-left w-full p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-surface-hover transition-all"
                      >
                        <div
                          className="w-full aspect-square rounded-lg mb-2 flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                          style={{ background: t.background_gradient || t.background_color }}
                        >
                          {t.thumbnail_url ? (
                            <img src={t.thumbnail_url} alt={t.name} className="w-full h-full object-cover rounded-lg" />
                          ) : t.name}
                        </div>
                        <p className="text-sm font-medium text-text-primary">{t.name}</p>
                        <p className="text-xs text-text-muted capitalize">{t.category}</p>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTemplateId(t.id); }}
                        className="absolute top-2 right-2 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        aria-label="Delete template"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Built-in templates */}
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Built-in</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { loadTemplate(t.id); setMobileSheet(null); }}
                  className="text-left p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-surface-hover transition-all group"
                >
                  <div
                    className="w-full aspect-square rounded-lg mb-2 flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: t.backgroundGradient || t.backgroundColor }}
                  >
                    {t.name}
                  </div>
                  <p className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors">{t.name}</p>
                  <p className="text-xs text-text-muted capitalize">{t.category}</p>
                </button>
              ))}
            </div>
          </>
        );
        return (
          <>
            <Modal open={templatePickerOpen} onClose={() => setTemplatePickerOpen(false)} title="Start from Template" maxWidth="max-w-md">
              {templateGrid}
            </Modal>
            <BottomSheet open={mobileSheet === 'templates'} onClose={() => setMobileSheet(null)} title="Templates">
              {templateGrid}
            </BottomSheet>
          </>
        );
      })()}

      {/* Delete User Template Confirmation */}
      <ConfirmDialog
        open={deleteTemplateId !== null}
        onClose={() => setDeleteTemplateId(null)}
        onConfirm={() => { if (deleteTemplateId) removeTemplate(deleteTemplateId); setDeleteTemplateId(null); }}
        title="Delete Template"
        message="Are you sure you want to delete this template? This cannot be undone."
        confirmLabel="Delete"
      />

      {/* Save as Template Modal */}
      <Modal open={saveTemplateModalOpen} onClose={() => setSaveTemplateModalOpen(false)} title="Save as Template" maxWidth="max-w-sm">
        <div className="space-y-4">
          <div>
            <label className="label">Template Name *</label>
            <input
              className="input-field"
              value={templateForm.name}
              onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="My Happy Hour Template"
            />
          </div>
          <div>
            <label className="label">Category</label>
            <select
              className="input-field"
              value={templateForm.category}
              onChange={(e) => setTemplateForm((f) => ({ ...f, category: e.target.value }))}
            >
              <option value="drink">Drink</option>
              <option value="food">Food</option>
              <option value="event">Event</option>
              <option value="seasonal">Seasonal</option>
            </select>
          </div>
          <p className="text-[13px] text-text-muted">Saves your current canvas layout as a reusable starting point.</p>
          <button
            onClick={handleSaveAsTemplate}
            disabled={savingTemplate || !templateForm.name.trim()}
            className="btn-primary w-full"
          >
            {savingTemplate ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {savingTemplate ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </Modal>

      {/* Save Modal */}
      <Modal open={saveModalOpen} onClose={() => setSaveModalOpen(false)} title="Save Special">
        <div className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input
              className="input-field"
              value={saveForm.title}
              onChange={(e) => setSaveForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Happy Hour Special"
              required
            />
          </div>
          <div>
            <label className="label">Description *</label>
            <textarea
              className="input-field min-h-[80px] resize-y"
              value={saveForm.description}
              onChange={(e) => setSaveForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="$5 well drinks and $3 draft beers..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type</label>
              <select
                className="input-field"
                value={saveForm.type}
                onChange={(e) => setSaveForm((f) => ({ ...f, type: e.target.value as 'drink' | 'food' | 'seasonal' }))}
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
                onChange={(e) => setSaveForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="$8"
              />
            </div>
          </div>
          {/* Publish Options */}
          <div className="border-t border-border pt-4 mt-1 space-y-3">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Publish To</p>

            {/* Post to Website */}
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                role="switch"
                aria-checked={publishOptions.postToWebsite}
                onClick={() => setPublishOptions(p => ({ ...p, postToWebsite: !p.postToWebsite }))}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                  publishOptions.postToWebsite ? 'bg-primary' : 'bg-surface-hover'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  publishOptions.postToWebsite ? 'translate-x-5' : ''
                }`} />
              </button>
              <Globe size={18} className={publishOptions.postToWebsite ? 'text-primary' : 'text-text-muted'} />
              <span className="text-sm text-text-primary">Post to Website</span>
            </label>

            {/* Share to Instagram */}
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                role="switch"
                aria-checked={publishOptions.shareToInstagram}
                onClick={() => setPublishOptions(p => ({ ...p, shareToInstagram: !p.shareToInstagram }))}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                  publishOptions.shareToInstagram
                    ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400'
                    : 'bg-surface-hover'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  publishOptions.shareToInstagram ? 'translate-x-5' : ''
                }`} />
              </button>
              <Instagram size={18} className={publishOptions.shareToInstagram ? 'text-pink-400' : 'text-text-muted'} />
              <span className="text-sm text-text-primary">
                {typeof navigator !== 'undefined' && 'share' in navigator ? 'Share to Instagram' : 'Download for Instagram'}
              </span>
            </label>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setSaveModalOpen(false)} className="btn-secondary">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving || !saveForm.title.trim() || !saveForm.description.trim()}
              className="btn-primary"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {(() => {
                const { postToWebsite, shareToInstagram } = publishOptions;
                if (isEdit) {
                  if (postToWebsite && shareToInstagram) return 'Update, Post & Share';
                  if (postToWebsite) return 'Update & Post';
                  if (shareToInstagram) return 'Update & Share';
                  return 'Update';
                }
                if (postToWebsite && shareToInstagram) return 'Save, Post & Share';
                if (postToWebsite) return 'Save & Post';
                if (shareToInstagram) return 'Save & Share';
                return 'Save';
              })()}
            </button>
          </div>
          <div className="border-t border-border mt-4 pt-3 text-center">
            <button
              onClick={() => { setSaveModalOpen(false); setSaveTemplateModalOpen(true); }}
              className="text-xs text-text-muted hover:text-primary transition-colors"
            >
              Or save as reusable template →
            </button>
          </div>
        </div>
      </Modal>
    </div>
    </VideoRefProvider>
  );
}
