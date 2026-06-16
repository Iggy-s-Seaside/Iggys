-- Close-out truth note for Luna's Night Chronicle (the close-out loop), 2026-06-16.
-- Luna named the close-out loop the "spine" of her room: a nightly hand-off of the
-- night's actuals so she writes the chronicle with truth in hand instead of "in the
-- dark." This column is the one-line truth captured at close-out (CloseOutCard) and
-- read by the nightly generator (bridge/luna_chronicle.py).
-- Applied to prod via migration `add_demand_log_note`.

alter table public.demand_log add column if not exists note text;

comment on column public.demand_log.note is 'Close-out truth note — one line on how the night actually went; fed to Luna''s Night Chronicle generator (the close-out loop).';
