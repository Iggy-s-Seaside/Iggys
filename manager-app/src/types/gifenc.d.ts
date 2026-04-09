declare module 'gifenc' {
  interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: number[][];
        delay?: number;
        repeat?: number;
        dispose?: number;
        transparent?: boolean;
        transparentIndex?: number;
      }
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
    buffer: ArrayBuffer;
  }

  export function GIFEncoder(opts?: { initialCapacity?: number; auto?: boolean }): GIFEncoderInstance;
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, opts?: { format?: string; oneBitAlpha?: boolean | number }): number[][];
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: number[][], format?: string): Uint8Array;
  export function prequantize(rgba: Uint8Array | Uint8ClampedArray, opts?: { roundRGB?: number; oneBitAlpha?: boolean | number }): void;
  export function nearestColorIndex(palette: number[][], pixel: number[]): number;
  export function nearestColor(palette: number[][], pixel: number[]): number[];
  export function snapColorsToPalette(palette: number[][], knownColors: number[][], threshold?: number): void;
}
