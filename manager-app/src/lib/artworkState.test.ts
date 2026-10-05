import { describe, it, expect, vi } from 'vitest';
import { prepareArtworkState, localDateTime } from './artworkState';
import type { EditorState } from '../types';
import { DEFAULT_IMAGE_FILTERS } from '../types';
const state = { backgroundImage:null, backgroundColor:'#fff', imageFilters:DEFAULT_IMAGE_FILTERS, layers:[], selectedLayerId:null, canvasWidth:1080, canvasHeight:1080 } as EditorState;
describe('portable editable artwork', () => {
 it('retains editable text and avoids uploading existing remote media', async () => {
  const resolve = vi.fn(); const input = {...state,layers:[{id:'title',text:'Live music',imageSrc:'https://example.com/photo.png'}]} as EditorState;
  expect((await prepareArtworkState(input,resolve)).layers).toEqual(input.layers); expect(resolve).not.toHaveBeenCalled();
 });
 it('resolves background, image and video sources before saving', async () => {
  const input = {...state,backgroundImage:'blob:background',selectedLayerId:'text',layers:[{id:'photo',imageSrc:'idb://photo'},{id:'video',videoSrc:'blob:video'}]} as EditorState;
  const saved = await prepareArtworkState(input,async src=>'https://example.com/'+encodeURIComponent(src));
  expect(saved.backgroundImage).toContain('https://');expect(saved.layers[0].imageSrc).toContain('https://');expect(saved.layers[1].videoSrc).toContain('https://');expect(saved.selectedLayerId).toBeNull();
  expect(input.backgroundImage).toBe('blob:background');
 });
 it('refuses a save when any media cannot be uploaded', async () => {
  await expect(prepareArtworkState({...state,backgroundImage:'blob:missing'},async()=>null)).rejects.toThrow('could not be saved');
 });
 it('round-trips a scheduled instant through the local form', () => {
  const iso='2026-09-20T03:00:00Z';expect(new Date(localDateTime(iso)).toISOString()).toBe('2026-09-20T03:00:00.000Z');
 });
});
