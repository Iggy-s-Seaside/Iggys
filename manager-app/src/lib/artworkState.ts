import type { EditorState } from '../types';

/** Save portable sources, so a reopened design does not depend on one browser's files. */
export async function prepareArtworkState(state: EditorState, resolve: (src: string) => Promise<string | null>): Promise<EditorState> {
  const portable = async (src: string | null | undefined) => {
    if (!src || /^https?:\/\//.test(src)) return src;
    const url = await resolve(src);
    if (!url || !/^https?:\/\//.test(url)) throw new Error('A photo or video could not be saved. Your artwork is still here; please try again.');
    return url;
  };
  return { ...state, selectedLayerId: null,
    backgroundImage: (await portable(state.backgroundImage)) ?? null,
    layers: await Promise.all(state.layers.map(async l => ({ ...l,
      ...(l.imageSrc ? { imageSrc: (await portable(l.imageSrc))! } : {}),
      ...(l.videoSrc ? { videoSrc: (await portable(l.videoSrc))! } : {}),
    }))),
  };
}

export function localDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16);
}
