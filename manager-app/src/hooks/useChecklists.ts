import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useImageUpload } from './useImageUpload';
import { todaysBusinessDay } from '../utils/businessDay';
import type {
  ChecklistKind,
  ChecklistTemplate,
  ChecklistTemplateItem,
  ChecklistRun,
  ChecklistRunItem,
  LineCheckTemplate,
  LineCheckTemplateItem,
  LineCheckRun,
  LineCheckReading,
} from '../types';

// ════════════════════════════════════════════════════════════
// Shared: resolve the active shift (explicit prop > current open shift)
// ════════════════════════════════════════════════════════════

/**
 * Resolve which shift a run should attach to. If `shiftId` is supplied
 * (from ?shift=) it wins; otherwise we resolve the current SERVICE session as
 * the most recent shift_sessions row stamped with today's business day (9am
 * Pacific cutoff) — NOT merely status=open. This is what makes today's
 * checklists roll on their own: past 9am the resolved id flips to the new
 * day's session, so a session left open overnight no longer pins yesterday's
 * checklist. Returns null when standalone / nothing for today — the run is
 * still recorded, just unattributed.
 */
export function useCurrentShiftId(shiftId?: number | null) {
  const [resolved, setResolved] = useState<number | null>(shiftId ?? null);

  useEffect(() => {
    let active = true;
    if (shiftId != null) {
      setResolved(shiftId);
      return;
    }
    (async () => {
      const today = todaysBusinessDay();
      // Primary: the most recent session for today's business day.
      const { data, error } = await supabase
        .from('shift_sessions')
        .select('id')
        .eq('business_day', today)
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (error) {
        // Missing table / column is non-fatal — run standalone.
        setResolved(null);
        return;
      }
      const todays = (data as { id: number } | null)?.id ?? null;
      if (todays != null) {
        setResolved(todays);
        return;
      }
      // Legacy fallback: rows written before business_day existed are still
      // resolvable by an open status (only used until they're stamped/closed).
      const { data: legacy } = await supabase
        .from('shift_sessions')
        .select('id')
        .eq('status', 'open')
        .is('business_day', null)
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      setResolved((legacy as { id: number } | null)?.id ?? null);
    })();
    return () => {
      active = false;
    };
  }, [shiftId]);

  return resolved;
}

// ════════════════════════════════════════════════════════════
// CHECKLISTS
// ════════════════════════════════════════════════════════════

export interface ChecklistTemplateWithItems extends ChecklistTemplate {
  items: ChecklistTemplateItem[];
}

/** Load every checklist template (optionally filtered by kind) with its items. */
export function useChecklistTemplates(kind?: ChecklistKind) {
  const [templates, setTemplates] = useState<ChecklistTemplateWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!loadedRef.current) setLoading(true);
    const [tplRes, itemRes] = await Promise.all([
      supabase
        .from('checklist_templates')
        .select('*')
        .eq('active', true)
        .order('sort_order'),
      supabase.from('checklist_template_items').select('*').order('sort_order'),
    ]);

    if (tplRes.error || itemRes.error) {
      toast.error('Failed to load checklists');
      console.error(tplRes.error ?? itemRes.error);
      loadedRef.current = true;
      setLoading(false);
      return;
    }

    const items = (itemRes.data as ChecklistTemplateItem[]) || [];
    const byTpl = (tplRes.data as ChecklistTemplate[]) || [];
    const grouped: ChecklistTemplateWithItems[] = byTpl
      .filter((t) => (kind ? t.kind === kind : true))
      .map((t) => ({
        ...t,
        items: items
          .filter((i) => i.template_id === t.id)
          .sort((a, b) => a.sort_order - b.sort_order),
      }));

    setTemplates(grouped);
    loadedRef.current = true;
    setLoading(false);
  }, [kind]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { templates, loading, refresh };
}

export interface ChecklistRunState {
  run: ChecklistRun | null;
  runItems: ChecklistRunItem[];
  loading: boolean;
  /** Map item_id -> run item, for quick lookup against template items. */
  byItemId: Map<number, ChecklistRunItem>;
}

/**
 * Start (or resume the latest open) run for a template within a shift, and
 * drive the per-item checkbox / photo / note state. A run is "open" until
 * `completed_at` is stamped; resuming finds the most recent open run for the
 * same (template, shift) so a manager who backs out doesn't lose progress.
 */
export function useChecklistRun(
  template: ChecklistTemplateWithItems | null,
  shiftId: number | null,
  completedBy: string | null
) {
  const [run, setRun] = useState<ChecklistRun | null>(null);
  const [runItems, setRunItems] = useState<ChecklistRunItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const loadedRef = useRef(false);
  const { upload, uploading } = useImageUpload();

  const templateId = template?.id ?? null;

  const loadRunItems = useCallback(async (runId: number) => {
    const { data, error } = await supabase
      .from('checklist_run_items')
      .select('*')
      .eq('run_id', runId);
    if (error) {
      toast.error('Failed to load checklist progress');
      return;
    }
    setRunItems((data as ChecklistRunItem[]) || []);
  }, []);

  // Resume the most recent open run for this template + shift, if any.
  const refresh = useCallback(async () => {
    if (templateId == null) {
      setRun(null);
      setRunItems([]);
      return;
    }
    if (!loadedRef.current) setLoading(true);
    let query = supabase
      .from('checklist_runs')
      .select('*')
      .eq('template_id', templateId)
      .is('completed_at', null)
      .order('created_at', { ascending: false })
      .limit(1);
    query = shiftId == null ? query.is('shift_id', null) : query.eq('shift_id', shiftId);

    const { data, error } = await query.maybeSingle();
    if (error) {
      toast.error('Failed to load checklist run');
      loadedRef.current = true;
      setLoading(false);
      return;
    }
    const found = (data as ChecklistRun | null) ?? null;
    setRun(found);
    if (found) {
      await loadRunItems(found.id);
    } else {
      setRunItems([]);
    }
    loadedRef.current = true;
    setLoading(false);
  }, [templateId, shiftId, loadRunItems]);

  // Reset the first-load guard on a genuine template/shift switch so the spinner
  // shows for the new run (same-run realtime refetches stay strobe-free).
  useEffect(() => {
    loadedRef.current = false;
  }, [templateId, shiftId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Create a fresh run + a blank run-item row per template item. */
  const startRun = useCallback(async (): Promise<ChecklistRun | null> => {
    if (!template) return null;
    setStarting(true);
    const { data, error } = await supabase
      .from('checklist_runs')
      .insert({ template_id: template.id, shift_id: shiftId })
      .select('*')
      .single();
    if (error || !data) {
      toast.error('Failed to start checklist');
      setStarting(false);
      return null;
    }
    const newRun = data as ChecklistRun;

    const seedRows = template.items.map((it) => ({
      run_id: newRun.id,
      item_id: it.id,
      checked: false,
    }));
    if (seedRows.length > 0) {
      const { error: seedErr } = await supabase.from('checklist_run_items').insert(seedRows);
      if (seedErr) {
        toast.error('Failed to start checklist');
        setStarting(false);
        return null;
      }
    }
    setRun(newRun);
    await loadRunItems(newRun.id);
    setStarting(false);
    return newRun;
  }, [template, shiftId, loadRunItems]);

  /** Ensure there is a run (resume or create) and return it. */
  const ensureRun = useCallback(async (): Promise<ChecklistRun | null> => {
    if (run) return run;
    return startRun();
  }, [run, startRun]);

  /**
   * Toggle / set an item's checked state, optionally attaching a freshly
   * uploaded photo and/or a note. Photo upload reuses the shared
   * useImageUpload pattern (magic-byte validated, public URL returned).
   */
  const setItem = useCallback(
    async (
      itemId: number,
      patch: { checked?: boolean; note?: string | null; photo?: File | null; clearPhoto?: boolean }
    ): Promise<boolean> => {
      const activeRun = await ensureRun();
      if (!activeRun) return false;

      const existing = runItems.find((ri) => ri.item_id === itemId);
      const fields: Partial<ChecklistRunItem> = {};

      if (patch.checked !== undefined) {
        fields.checked = patch.checked;
        fields.checked_at = patch.checked ? new Date().toISOString() : null;
      }
      if (patch.note !== undefined) fields.note = patch.note;

      if (patch.clearPhoto) {
        fields.photo_url = null;
      } else if (patch.photo) {
        const url = await upload(patch.photo, 'checklists');
        if (!url) return false; // upload() already surfaced the toast
        fields.photo_url = url;
      }

      if (Object.keys(fields).length === 0) return true;

      if (existing) {
        const { error } = await supabase
          .from('checklist_run_items')
          .update(fields as Record<string, unknown>)
          .eq('id', existing.id);
        if (error) {
          toast.error('Failed to save');
          return false;
        }
      } else {
        const { error } = await supabase
          .from('checklist_run_items')
          .insert({ run_id: activeRun.id, item_id: itemId, checked: false, ...fields });
        if (error) {
          toast.error('Failed to save');
          return false;
        }
      }
      await loadRunItems(activeRun.id);
      return true;
    },
    [ensureRun, runItems, upload, loadRunItems]
  );

  // ── Derived: completion + photo gating ──

  const byItemId = useMemo(() => {
    const m = new Map<number, ChecklistRunItem>();
    runItems.forEach((ri) => m.set(ri.item_id, ri));
    return m;
  }, [runItems]);

  const total = template?.items.length ?? 0;
  const checkedCount = useMemo(
    () => (template ? template.items.filter((it) => byItemId.get(it.id)?.checked).length : 0),
    [template, byItemId]
  );
  const percent = total === 0 ? 0 : Math.round((checkedCount / total) * 100);

  /** Items that are checked but still missing a required photo. */
  const photoBlockers = useMemo(
    () =>
      (template?.items ?? []).filter((it) => {
        if (!it.requires_photo) return false;
        const ri = byItemId.get(it.id);
        return ri?.checked && !ri?.photo_url;
      }),
    [template, byItemId]
  );

  const canComplete = total > 0 && checkedCount === total && photoBlockers.length === 0;

  /** Stamp the run complete. Blocked unless every item is checked + photo-proofed. */
  const completeRun = useCallback(async (): Promise<boolean> => {
    if (!run) return false;
    if (!canComplete) {
      if (photoBlockers.length > 0) {
        toast.error('Add the required photo before completing');
      } else {
        toast.error('Check every item before completing');
      }
      return false;
    }
    const { error } = await supabase
      .from('checklist_runs')
      .update({ completed_at: new Date().toISOString(), completed_by: completedBy })
      .eq('id', run.id);
    if (error) {
      toast.error('Failed to complete checklist');
      return false;
    }
    toast.success('Checklist completed');
    await refresh();
    return true;
  }, [run, canComplete, photoBlockers, completedBy, refresh]);

  return {
    run,
    runItems,
    byItemId,
    loading,
    starting,
    uploading,
    total,
    checkedCount,
    percent,
    photoBlockers,
    canComplete,
    startRun,
    setItem,
    completeRun,
    refresh,
  };
}

// ════════════════════════════════════════════════════════════
// LINE CHECK
// ════════════════════════════════════════════════════════════

export interface LineCheckTemplateWithItems extends LineCheckTemplate {
  items: LineCheckTemplateItem[];
}

/** Load the line-check templates with their reading points. */
export function useLineCheckTemplates() {
  const [templates, setTemplates] = useState<LineCheckTemplateWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!loadedRef.current) setLoading(true);
    const [tplRes, itemRes] = await Promise.all([
      supabase
        .from('line_check_templates')
        .select('*')
        .eq('active', true)
        .order('sort_order'),
      supabase.from('line_check_template_items').select('*').order('sort_order'),
    ]);

    if (tplRes.error || itemRes.error) {
      toast.error('Failed to load line check');
      console.error(tplRes.error ?? itemRes.error);
      loadedRef.current = true;
      setLoading(false);
      return;
    }

    const items = (itemRes.data as LineCheckTemplateItem[]) || [];
    const grouped: LineCheckTemplateWithItems[] = ((tplRes.data as LineCheckTemplate[]) || []).map(
      (t) => ({
        ...t,
        items: items
          .filter((i) => i.template_id === t.id)
          .sort((a, b) => a.sort_order - b.sort_order),
      })
    );

    setTemplates(grouped);
    loadedRef.current = true;
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { templates, loading, refresh };
}

/** Pure: is `value` within [min, max]? Open-ended bounds are honoured. */
export function isInRange(
  value: number,
  min: number | null,
  max: number | null
): boolean {
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

/**
 * Drive a single line-check run: capture a numeric reading per item, flag
 * out-of-range values, and (on demand) spawn a corrective to-do for a fail.
 */
export function useLineCheckRun(
  template: LineCheckTemplateWithItems | null,
  shiftId: number | null,
  completedBy: string | null
) {
  const [run, setRun] = useState<LineCheckRun | null>(null);
  const [readings, setReadings] = useState<LineCheckReading[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);

  const templateId = template?.id ?? null;

  const loadReadings = useCallback(async (runId: number) => {
    const { data, error } = await supabase
      .from('line_check_readings')
      .select('*')
      .eq('run_id', runId);
    if (error) {
      toast.error('Failed to load readings');
      return;
    }
    setReadings((data as LineCheckReading[]) || []);
  }, []);

  // Resume the latest run for this shift (line checks have no completed flag —
  // the most recent run for the shift is the live one).
  const refresh = useCallback(async () => {
    if (templateId == null) {
      setRun(null);
      setReadings([]);
      return;
    }
    if (!loadedRef.current) setLoading(true);
    let query = supabase
      .from('line_check_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    query = shiftId == null ? query.is('shift_id', null) : query.eq('shift_id', shiftId);

    const { data, error } = await query.maybeSingle();
    if (error) {
      toast.error('Failed to load line check');
      loadedRef.current = true;
      setLoading(false);
      return;
    }
    const found = (data as LineCheckRun | null) ?? null;
    setRun(found);
    if (found) {
      await loadReadings(found.id);
    } else {
      setReadings([]);
    }
    loadedRef.current = true;
    setLoading(false);
  }, [templateId, shiftId, loadReadings]);

  // Reset the first-load guard on a genuine template/shift switch so the spinner
  // shows for the new run (same-run realtime refetches stay strobe-free).
  useEffect(() => {
    loadedRef.current = false;
  }, [templateId, shiftId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const ensureRun = useCallback(async (): Promise<LineCheckRun | null> => {
    if (run) return run;
    const { data, error } = await supabase
      .from('line_check_runs')
      .insert({ shift_id: shiftId, completed_by: completedBy })
      .select('*')
      .single();
    if (error || !data) {
      toast.error('Failed to start line check');
      return null;
    }
    const newRun = data as LineCheckRun;
    setRun(newRun);
    return newRun;
  }, [run, shiftId, completedBy]);

  const byItemId = useMemo(() => {
    const m = new Map<number, LineCheckReading>();
    readings.forEach((r) => m.set(r.item_id, r));
    return m;
  }, [readings]);

  /** Record (or update) a reading. in_range is computed from the item's bounds. */
  const recordReading = useCallback(
    async (
      item: LineCheckTemplateItem,
      value: number,
      note?: string | null
    ): Promise<LineCheckReading | null> => {
      const activeRun = await ensureRun();
      if (!activeRun) return null;
      setSaving(true);

      const inRange = isInRange(value, item.min_value, item.max_value);
      const existing = byItemId.get(item.id);

      if (existing) {
        const { error } = await supabase
          .from('line_check_readings')
          .update({ value, in_range: inRange, note: note ?? existing.note })
          .eq('id', existing.id);
        if (error) {
          toast.error('Failed to save reading');
          setSaving(false);
          return null;
        }
      } else {
        const { error } = await supabase.from('line_check_readings').insert({
          run_id: activeRun.id,
          item_id: item.id,
          value,
          in_range: inRange,
          note: note ?? null,
        });
        if (error) {
          toast.error('Failed to save reading');
          setSaving(false);
          return null;
        }
      }
      await loadReadings(activeRun.id);
      setSaving(false);
      return { ...(existing ?? ({} as LineCheckReading)), item_id: item.id, value, in_range: inRange } as LineCheckReading;
    },
    [ensureRun, byItemId, loadReadings]
  );

  /**
   * Spawn a corrective to-do for an out-of-range reading. Returns true on
   * success; the caller decides when to offer it (typically on a fail).
   */
  const logCorrectiveTask = useCallback(
    async (item: LineCheckTemplateItem, value: number): Promise<boolean> => {
      const unit = item.unit ? `${item.unit}` : '';
      const rangeLabel =
        item.min_value != null && item.max_value != null
          ? `${item.min_value}-${item.max_value}${unit}`
          : item.min_value != null
            ? `≥${item.min_value}${unit}`
            : item.max_value != null
              ? `≤${item.max_value}${unit}`
              : '';
      const { error } = await supabase.from('todos').insert({
        title: `Line check fail: ${item.label}`,
        details: `Read ${value}${unit}${rangeLabel ? ` — safe range ${rangeLabel}` : ''}. Correct and recheck.`,
        priority: 'high',
        done: false,
        created_by: completedBy,
      });
      if (error) {
        toast.error('Failed to log task');
        return false;
      }
      toast.success('Corrective task added to To-Do');
      return true;
    },
    [completedBy]
  );

  const failures = useMemo(
    () => readings.filter((r) => r.in_range === false),
    [readings]
  );

  return {
    run,
    readings,
    byItemId,
    failures,
    loading,
    saving,
    recordReading,
    logCorrectiveTask,
    refresh,
  };
}
