alter table public.specials add column editor_state jsonb;
alter table public.specials add constraint specials_editor_state_object check(editor_state is null or jsonb_typeof(editor_state) = 'object');
comment on column public.specials.editor_state is 'Editable artwork document with portable media URLs. NULL for legacy flattened images.';
