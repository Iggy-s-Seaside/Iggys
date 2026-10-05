import type { EditorState, TextLayer } from '../../types';

export function SimpleDesignPanel({ state, onText, onAddText, onLayout, onPhoto, onUpload, onBackground, onSize, onAdvanced, legacy }: {
  state: EditorState; onText: (id: string, changes: Partial<TextLayer>, transient?: boolean) => void;
  onAddText: () => void; onLayout: (id: string) => void; onPhoto: () => void; onUpload: () => void;
  onBackground: (color: string) => void; onSize: (w: number, h: number) => void; onAdvanced: () => void; legacy: boolean;
}) {
  const texts = state.layers.filter(l => (!l.elementType || l.elementType === 'text') && l.visible !== false);
  return <aside className="p-5 space-y-6 bg-surface md:w-[360px] md:shrink-0 md:overflow-y-auto border-border md:border-r order-2 md:order-1" aria-label="Edit your artwork">
    <section className="space-y-3">
      <h2 className="font-semibold text-lg">1. Choose a layout</h2>
      <div className="grid grid-cols-3 gap-2">{[['simple-coastal','Coastal','#103f44'],['simple-night','Night','#221b38'],['simple-clean','Classic','#f7f0df']].map(([id,label,color]) => <button key={id} className="rounded-xl border border-border p-2 min-h-[76px] hover:border-primary text-sm font-medium" onClick={() => onLayout(id)}><span className="block h-7 rounded mb-2" style={{background:color}} />{label}</button>)}</div>
      <label className="block text-sm font-medium">Picture shape<select className="input-field mt-2" value={state.canvasWidth === state.canvasHeight ? 'square' : state.canvasWidth / state.canvasHeight === 9 / 16 ? 'story' : 'custom'} onChange={e => e.target.value === 'square' ? onSize(1080,1080) : onSize(1080,1920)}><option value="square">Square post</option><option value="story">Tall phone story</option>{state.canvasWidth !== state.canvasHeight && state.canvasWidth / state.canvasHeight !== 9/16 && <option value="custom">Current size</option>}</select></label>
    </section>
    <section className="space-y-3">
      <h2 className="font-semibold text-lg">2. Change the words</h2>
      {legacy && !texts.length && <p className="text-sm text-text-secondary">This older artwork was saved as one picture. Its words cannot be changed separately. Choose a layout to rebuild it, or add text over the picture.</p>}
      {!texts.length && !legacy && <p className="text-sm text-text-secondary">Choose a layout above, or add your own text.</p>}
      {texts.map((l,i) => <label key={l.id} className="block text-sm font-medium">{i === 0 ? 'Headline' : `Text ${i + 1}`}{l.locked ? ' (locked)' : ''}<textarea className="input-field mt-2 min-h-[76px] resize-y" value={l.text} disabled={l.locked} onChange={e => onText(l.id,{text:e.target.value})} /></label>)}
      <button className="btn-secondary w-full" onClick={onAddText}>Add a line of text</button>
    </section>
    <section className="space-y-3">
      <h2 className="font-semibold text-lg">3. Add a photo or colour</h2>
      <div className="grid grid-cols-2 gap-2"><button className="btn-secondary" onClick={onPhoto}>Choose photo</button><button className="btn-secondary" onClick={onUpload}>Upload photo</button></div>
      <label className="flex items-center justify-between gap-3 text-sm font-medium">Background colour<input type="color" aria-label="Background colour" value={state.backgroundColor} onChange={e => onBackground(e.target.value)} className="h-11 w-16 rounded cursor-pointer" /></label>
    </section>
    <p className="text-sm text-text-secondary">The preview updates as you type. Drag words on the picture to move them.</p>
    <button className="btn-secondary w-full" onClick={onAdvanced}>More design tools</button>
  </aside>;
}
