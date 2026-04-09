// WCAG 2.2 contrast ratio utilities + gradient color interpolation

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return [r, g, b];
}

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function getContrastRatio(color1: string, color2: string): number {
  const [r1, g1, b1] = hexToRgb(color1);
  const [r2, g2, b2] = hexToRgb(color2);
  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

interface GradientStop {
  color: [number, number, number];
  position: number; // 0-1
}

function parseGradientStops(gradient: string): GradientStop[] {
  // Extract color stops from CSS gradient like "linear-gradient(180deg, #060d1a 0%, #0a2040 30%, ...)"
  const stopsMatch = gradient.match(/#[0-9a-fA-F]{6}\s+\d+%/g);
  if (!stopsMatch) return [];

  return stopsMatch.map((stop) => {
    const parts = stop.trim().split(/\s+/);
    const hex = parts[0];
    const pct = parseFloat(parts[1]) / 100;
    return { color: hexToRgb(hex), position: pct };
  });
}

function lerpColor(
  c1: [number, number, number],
  c2: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

export function getGradientColorAtY(gradient: string, y: number, canvasHeight: number): string {
  const stops = parseGradientStops(gradient);
  if (stops.length === 0) return '#000000';

  const position = Math.max(0, Math.min(1, y / canvasHeight));

  // Find the two stops this position falls between
  if (position <= stops[0].position) return rgbToHex(...stops[0].color);
  if (position >= stops[stops.length - 1].position) return rgbToHex(...stops[stops.length - 1].color);

  for (let i = 0; i < stops.length - 1; i++) {
    if (position >= stops[i].position && position <= stops[i + 1].position) {
      const range = stops[i + 1].position - stops[i].position;
      const t = range === 0 ? 0 : (position - stops[i].position) / range;
      const interpolated = lerpColor(stops[i].color, stops[i + 1].color, t);
      return rgbToHex(...interpolated);
    }
  }

  return rgbToHex(...stops[0].color);
}

export function getBestTextColor(bgColor: string): string {
  const white = '#ffffff';
  const teal = '#2dd4bf';
  const whiteContrast = getContrastRatio(bgColor, white);
  const tealContrast = getContrastRatio(bgColor, teal);
  return whiteContrast >= tealContrast ? white : teal;
}

export interface ContrastIssue {
  layerId: string;
  currentColor: string;
  suggestedColor: string;
  contrastRatio: number;
}

export function findContrastIssues(
  gradient: string,
  layers: { id: string; y: number; fill: string; elementType?: string }[],
  canvasHeight: number,
): ContrastIssue[] {
  const issues: ContrastIssue[] = [];
  const minRatio = 3; // WCAG AA large text

  for (const layer of layers) {
    if (layer.elementType === 'image' || layer.elementType === 'video') continue;

    const bgColor = getGradientColorAtY(gradient, layer.y, canvasHeight);
    const ratio = getContrastRatio(bgColor, layer.fill);

    if (ratio < minRatio) {
      issues.push({
        layerId: layer.id,
        currentColor: layer.fill,
        suggestedColor: getBestTextColor(bgColor),
        contrastRatio: ratio,
      });
    }
  }

  return issues;
}
