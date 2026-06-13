// useCompliance — the compliance-vault data layer (refusals, incidents, temps, creds).
//
// Three of these tables are APPEND-ONLY by design (refusal_logs, incidents,
// temperature_logs): you can read and create, never edit or delete — that immutability
// is the whole point of a defensible compliance record. The two registry tables
// (temp_units, credentials) support full CRUD.
//
// Types are defined + exported here so the page can import from one place. The same
// shapes should be added to src/types/index.ts as canonical app types (see the agent's
// integration notes) — these local re-exports keep the hook self-contained meanwhile.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

// ── Types ────────────────────────────────────────────────────────────────────

export const REFUSAL_REASONS = ['intoxicated', 'no_id', 'underage', 'fake_id', 'other'] as const;
export type RefusalReason = (typeof REFUSAL_REASONS)[number];

export interface RefusalLog {
  id: number;
  created_at: string;
  shift_id: number | null;
  server: string | null;
  reason: string;
  notes: string | null;
}

export const INCIDENT_TYPES = ['injury', 'altercation', 'ejection', 'property', 'medical', 'other'] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export interface Incident {
  id: number;
  created_at: string;
  shift_id: number | null;
  type: string;
  description: string;
  action_taken: string | null;
  photo_url: string | null;
}

export interface TempUnit {
  id: number;
  created_at: string;
  name: string;
  min_f: number;
  max_f: number;
  active: boolean;
}

export interface TemperatureLog {
  id: number;
  created_at: string;
  unit_id: number | null;
  value_f: number;
  in_range: boolean;
}

export const CREDENTIAL_TYPES = [
  'liquor',
  'food_handler',
  'serving',
  'health',
  'fire',
  'insurance',
  'other',
] as const;
export type CredentialType = (typeof CREDENTIAL_TYPES)[number];

export interface Credential {
  id: number;
  created_at: string;
  name: string;
  type: string;
  holder: string | null;
  expires_on: string | null; // ISO date (yyyy-MM-dd)
}

// ── Expiry helpers (90/60/30/7-day chips) ──────────────────────────────────────

export type ExpiryTier = 'expired' | 'd7' | 'd30' | 'd60' | 'd90' | 'ok' | 'none';

export interface ExpiryStatus {
  tier: ExpiryTier;
  days: number | null; // days until expiry (negative = expired); null when no date
  label: string;
}

/** Bucket a credential's expiry into a 90/60/30/7-day tier for the chip UI. */
export function expiryStatus(expiresOn: string | null): ExpiryStatus {
  if (!expiresOn) return { tier: 'none', days: null, label: 'No expiry' };
  const days = differenceInCalendarDays(parseISO(expiresOn), new Date());
  if (days < 0) return { tier: 'expired', days, label: `Expired ${Math.abs(days)}d ago` };
  if (days <= 7) return { tier: 'd7', days, label: `${days}d left` };
  if (days <= 30) return { tier: 'd30', days, label: `${days}d left` };
  if (days <= 60) return { tier: 'd60', days, label: `${days}d left` };
  if (days <= 90) return { tier: 'd90', days, label: `${days}d left` };
  return { tier: 'ok', days, label: `${days}d left` };
}

// ── Inputs ─────────────────────────────────────────────────────────────────────

export interface AddRefusalInput {
  server?: string | null;
  reason: string;
  notes?: string | null;
  shiftId?: number | null;
}

export interface AddIncidentInput {
  type: string;
  description: string;
  actionTaken?: string | null;
  photoUrl?: string | null;
  shiftId?: number | null;
}

export interface AddTemperatureInput {
  unitId: number;
  valueF: number;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCompliance() {
  const { user } = useAuth();

  const [refusals, setRefusals] = useState<RefusalLog[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [units, setUnits] = useState<TempUnit[]>([]);
  const [temps, setTemps] = useState<TemperatureLog[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [r, i, u, t, c] = await Promise.all([
      supabase.from('refusal_logs').select('*').order('created_at', { ascending: false }),
      supabase.from('incidents').select('*').order('created_at', { ascending: false }),
      supabase.from('temp_units').select('*').order('name', { ascending: true }),
      supabase.from('temperature_logs').select('*').order('created_at', { ascending: false }),
      supabase.from('credentials').select('*').order('expires_on', { ascending: true, nullsFirst: false }),
    ]);
    const firstErr = r.error || i.error || u.error || t.error || c.error;
    if (firstErr) {
      console.error('[compliance] load error:', firstErr.message);
      toast.error('Failed to load compliance data. Please refresh.');
    }
    setRefusals((r.data as RefusalLog[]) || []);
    setIncidents((i.data as Incident[]) || []);
    setUnits((u.data as TempUnit[]) || []);
    setTemps((t.data as TemperatureLog[]) || []);
    setCredentials((c.data as Credential[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Refusals (append-only) ──
  const addRefusal = useCallback(
    async (input: AddRefusalInput): Promise<boolean> => {
      const { error } = await supabase.from('refusal_logs').insert({
        shift_id: input.shiftId ?? null,
        server: input.server?.trim() || user?.email || null,
        reason: input.reason,
        notes: input.notes?.trim() || null,
      });
      if (error) {
        console.error('[refusal_logs] insert error:', error.message);
        toast.error('Failed to log refusal. Please try again.');
        return false;
      }
      toast.success('Refusal logged');
      await refresh();
      return true;
    },
    [refresh, user?.email]
  );

  // ── Incidents (append-only) ──
  const addIncident = useCallback(
    async (input: AddIncidentInput): Promise<boolean> => {
      if (!input.description.trim()) {
        toast.error('Describe what happened first');
        return false;
      }
      const { error } = await supabase.from('incidents').insert({
        shift_id: input.shiftId ?? null,
        type: input.type,
        description: input.description.trim(),
        action_taken: input.actionTaken?.trim() || null,
        photo_url: input.photoUrl || null,
      });
      if (error) {
        console.error('[incidents] insert error:', error.message);
        toast.error('Failed to file incident. Please try again.');
        return false;
      }
      toast.success('Incident filed');
      await refresh();
      return true;
    },
    [refresh]
  );

  // ── Temperature units (registry CRUD) ──
  const addUnit = useCallback(
    async (name: string, minF: number, maxF: number): Promise<boolean> => {
      if (!name.trim()) {
        toast.error('Name the unit first');
        return false;
      }
      const { error } = await supabase
        .from('temp_units')
        .insert({ name: name.trim(), min_f: minF, max_f: maxF });
      if (error) {
        console.error('[temp_units] insert error:', error.message);
        toast.error('Failed to add unit.');
        return false;
      }
      toast.success('Unit added');
      await refresh();
      return true;
    },
    [refresh]
  );

  const updateUnit = useCallback(
    async (id: number, fields: Partial<Pick<TempUnit, 'name' | 'min_f' | 'max_f' | 'active'>>): Promise<boolean> => {
      const { error } = await supabase.from('temp_units').update(fields).eq('id', id);
      if (error) {
        console.error('[temp_units] update error:', error.message);
        toast.error('Failed to update unit.');
        return false;
      }
      await refresh();
      return true;
    },
    [refresh]
  );

  const removeUnit = useCallback(
    async (id: number): Promise<boolean> => {
      const { error } = await supabase.from('temp_units').delete().eq('id', id);
      if (error) {
        console.error('[temp_units] delete error:', error.message);
        toast.error('Failed to remove unit.');
        return false;
      }
      toast.success('Unit removed');
      await refresh();
      return true;
    },
    [refresh]
  );

  // ── Temperature logs (append-only; in_range snapshotted at log time) ──
  const addTemperature = useCallback(
    async (input: AddTemperatureInput): Promise<boolean> => {
      const unit = units.find((u) => u.id === input.unitId);
      if (!unit) {
        toast.error('Unknown unit');
        return false;
      }
      const inRange = input.valueF >= unit.min_f && input.valueF <= unit.max_f;
      const { error } = await supabase.from('temperature_logs').insert({
        unit_id: input.unitId,
        value_f: input.valueF,
        in_range: inRange,
      });
      if (error) {
        console.error('[temperature_logs] insert error:', error.message);
        toast.error('Failed to log reading. Please try again.');
        return false;
      }
      toast.success(inRange ? 'Reading logged' : 'Logged — OUT OF RANGE');
      await refresh();
      return true;
    },
    [refresh, units]
  );

  // ── Credentials (registry CRUD) ──
  const addCredential = useCallback(
    async (fields: Omit<Credential, 'id' | 'created_at'>): Promise<boolean> => {
      if (!fields.name.trim()) {
        toast.error('Name the credential first');
        return false;
      }
      const { error } = await supabase.from('credentials').insert({
        name: fields.name.trim(),
        type: fields.type,
        holder: fields.holder?.trim() || null,
        expires_on: fields.expires_on || null,
      });
      if (error) {
        console.error('[credentials] insert error:', error.message);
        toast.error('Failed to add credential.');
        return false;
      }
      toast.success('Credential added');
      await refresh();
      return true;
    },
    [refresh]
  );

  const updateCredential = useCallback(
    async (id: number, fields: Partial<Omit<Credential, 'id' | 'created_at'>>): Promise<boolean> => {
      const { error } = await supabase.from('credentials').update(fields).eq('id', id);
      if (error) {
        console.error('[credentials] update error:', error.message);
        toast.error('Failed to update credential.');
        return false;
      }
      toast.success('Credential updated');
      await refresh();
      return true;
    },
    [refresh]
  );

  const removeCredential = useCallback(
    async (id: number): Promise<boolean> => {
      const { error } = await supabase.from('credentials').delete().eq('id', id);
      if (error) {
        console.error('[credentials] delete error:', error.message);
        toast.error('Failed to remove credential.');
        return false;
      }
      toast.success('Credential removed');
      await refresh();
      return true;
    },
    [refresh]
  );

  // ── Derived: latest reading per unit + soonest expiry tier counts ──
  const latestTempByUnit = useMemo(() => {
    const map = new Map<number, TemperatureLog>();
    // temps are sorted newest-first, so the first seen per unit is the latest.
    for (const t of temps) {
      if (t.unit_id != null && !map.has(t.unit_id)) map.set(t.unit_id, t);
    }
    return map;
  }, [temps]);

  const expiringCount = useMemo(
    () =>
      credentials.filter((c) => {
        const s = expiryStatus(c.expires_on);
        return s.tier === 'expired' || s.tier === 'd7' || s.tier === 'd30';
      }).length,
    [credentials]
  );

  return {
    loading,
    refresh,
    // data
    refusals,
    incidents,
    units,
    temps,
    credentials,
    latestTempByUnit,
    expiringCount,
    // actions
    addRefusal,
    addIncident,
    addUnit,
    updateUnit,
    removeUnit,
    addTemperature,
    addCredential,
    updateCredential,
    removeCredential,
  };
}
