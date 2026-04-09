/**
 * Shared constants used across the editor UI.
 * Single source of truth — import from here instead of duplicating.
 */

import type { ImageFilters } from '../../types';
import type { LucideIcon } from 'lucide-react';
import { Sun, Contrast, Droplets, CloudFog, Heading1, Heading2, Type, Tag, Megaphone, Minus } from 'lucide-react';

/** Minimum touch target size in screen pixels (Apple HIG) */
export const MIN_TOUCH_TARGET = 44;

/** Overlay color quick-picks shared by MobileFilterBar, MobileBlendPicker, and ImageAdjustments */
export const OVERLAY_COLORS = ['#000000', '#1a1a2e', '#0d9488', '#f59e0b', '#ef4444', '#8b5cf6'];

/** Blend modes for Enlight-style double exposure — used by PropertyPanel and MobileBlendPicker */
export const BLEND_MODES: { value: string; label: string; description: string }[] = [
  { value: 'normal', label: 'Normal', description: 'No blending' },
  { value: 'screen', label: 'Screen', description: 'Lighten & merge' },
  { value: 'multiply', label: 'Multiply', description: 'Darken & merge' },
  { value: 'overlay', label: 'Overlay', description: 'Contrast blend' },
  { value: 'soft-light', label: 'Soft Light', description: 'Gentle glow' },
  { value: 'hard-light', label: 'Hard Light', description: 'Strong glow' },
  { value: 'difference', label: 'Difference', description: 'Invert colors' },
  { value: 'exclusion', label: 'Exclusion', description: 'Soft invert' },
  { value: 'color-dodge', label: 'Dodge', description: 'Brighten colors' },
  { value: 'color-burn', label: 'Burn', description: 'Deepen colors' },
  { value: 'luminosity', label: 'Luminosity', description: 'Light only' },
  { value: 'darken', label: 'Darken', description: 'Keep darks' },
  { value: 'lighten', label: 'Lighten', description: 'Keep lights' },
];

/** Canvas blend mode mapping: CSS mix-blend-mode → Canvas globalCompositeOperation */
export const CANVAS_BLEND_MAP: Record<string, GlobalCompositeOperation> = {
  'screen': 'screen',
  'multiply': 'multiply',
  'overlay': 'overlay',
  'soft-light': 'soft-light',
  'hard-light': 'hard-light',
  'difference': 'difference',
  'exclusion': 'exclusion',
  'color-dodge': 'color-dodge',
  'color-burn': 'color-burn',
  'luminosity': 'luminosity',
  'darken': 'darken',
  'lighten': 'lighten',
};

/** Slider config for filter adjustment UI — used by MobileFilterBar and MobileBlendPicker */
export type ActiveSlider = 'brightness' | 'contrast' | 'saturation' | 'blur' | 'overlay' | null;

export const SLIDER_CONFIG: { id: ActiveSlider; icon: typeof Sun; label: string; key: keyof ImageFilters; min: number; max: number }[] = [
  { id: 'brightness', icon: Sun, label: 'Brightness', key: 'brightness', min: 0, max: 200 },
  { id: 'contrast', icon: Contrast, label: 'Contrast', key: 'contrast', min: 0, max: 200 },
  { id: 'saturation', icon: Droplets, label: 'Saturation', key: 'saturation', min: 0, max: 200 },
  { id: 'blur', icon: CloudFog, label: 'Blur', key: 'blur', min: 0, max: 20 },
];

/** Text presets for quick add — shared by SpecialEditor and MobileToolbar */
export const TEXT_PRESETS: { label: string; icon: LucideIcon; overrides: Record<string, unknown> }[] = [
  { label: 'Heading', icon: Heading1, overrides: { text: 'HEADING', fontSize: 96, fontFamily: 'Bebas Neue', fontStyle: 'bold', fill: '#ffffff', letterSpacing: 4 } },
  { label: 'Subtitle', icon: Heading2, overrides: { text: 'Subtitle text', fontSize: 36, fontFamily: 'Montserrat', fill: '#94a3b8', letterSpacing: 2 } },
  { label: 'Item', icon: Type, overrides: { text: '$5 ITEM NAME', fontSize: 36, fontFamily: 'Oswald', fontStyle: 'bold', fill: '#ffffff', align: 'center' as const, letterSpacing: 1 } },
  { label: 'Price', icon: Tag, overrides: { text: '$5', fontSize: 72, fontFamily: 'Anton', fill: '#f59e0b', fontStyle: 'bold' } },
  { label: 'CTA', icon: Megaphone, overrides: { text: 'JOIN US!', fontSize: 48, fontFamily: 'Oswald', fill: '#2dd4bf', fontStyle: 'bold', letterSpacing: 3 } },
  { label: 'Divider', icon: Minus, overrides: { elementType: 'divider' as const, text: 'SECTION', dividerLabel: 'SECTION', fontSize: 20, fontFamily: 'Montserrat', fontWeight: 600, fill: '#2dd4bf', letterSpacing: 4, dividerLineColor: '#2dd4bf', dividerLineOpacity: 0.4, dividerLineThickness: 1, dividerPadding: 40, dividerGap: 16, width: 1080 } },
];
