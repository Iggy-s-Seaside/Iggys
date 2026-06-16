import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Pricing category for a package — mirrors the manager app's PACKAGE_CATEGORIES.
 * 'other' is treated as an add-on for public-facing display + estimate math.
 */
export type PublicPackageCategory = 'food' | 'drink' | 'room' | 'addon' | 'other';

/** How a package's price is applied — mirrors the manager app's PACKAGE_UNITS. */
export type PublicPackageUnit = 'flat' | 'per_person' | 'per_hour';

const CATEGORIES: readonly PublicPackageCategory[] = ['food', 'drink', 'room', 'addon', 'other'];
const UNITS: readonly PublicPackageUnit[] = ['flat', 'per_person', 'per_hour'];

const toCategory = (c: unknown): PublicPackageCategory =>
  CATEGORIES.includes(c as PublicPackageCategory) ? (c as PublicPackageCategory) : 'other';

const toUnit = (u: unknown): PublicPackageUnit =>
  UNITS.includes(u as PublicPackageUnit) ? (u as PublicPackageUnit) : 'flat';

/** A package as the public site needs it — normalized + safe defaults. */
export interface PublicPackage {
  id: number;
  name: string;
  /** Internal description (always present in the catalog). */
  description: string | null;
  /** Optional guest-facing copy; falls back to `description` when the column is absent/empty. */
  publicDescription: string | null;
  category: PublicPackageCategory;
  price: number;
  unit: PublicPackageUnit;
  /** Highlighted card on the public site. Defaults to false when the column doesn't exist yet. */
  featured: boolean;
  /** Whether the package is shown to customers. Manager-only detailed packages are `false`. */
  publicVisible: boolean;
  sortOrder: number;
}

/**
 * Raw row shape. `public_description` / `featured` are optional because those
 * columns may not exist yet — we `select('*')` and read them defensively.
 */
interface PackageRow {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  price: number | null;
  unit: string | null;
  active: boolean;
  sort_order: number | null;
  public_description?: string | null;
  featured?: boolean | null;
  public_visible?: boolean | null;
}

function normalize(row: PackageRow): PublicPackage {
  const publicDesc = (row.public_description ?? '').trim() || (row.description ?? '').trim() || null;
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    publicDescription: publicDesc,
    category: toCategory(row.category),
    price: row.price ?? 0,
    unit: toUnit(row.unit),
    featured: row.featured === true,
    publicVisible: row.public_visible !== false,
    sortOrder: row.sort_order ?? 0,
  };
}

/**
 * Fetch active packages with their public-facing fields. Uses `select('*')` so
 * it gracefully tolerates a `public_description` / `featured` column that may
 * not exist in the schema yet — both degrade to safe defaults.
 */
export function usePublicPackages() {
  const [packages, setPackages] = useState<PublicPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data, error: qErr } = await supabase
        .from('packages')
        .select('*')
        .eq('active', true)
        .eq('public_visible', true)
        .order('sort_order');

      if (cancelled) return;

      if (qErr) {
        setError(qErr.message);
        setPackages([]);
      } else {
        setError(null);
        setPackages(((data as PackageRow[]) ?? []).map(normalize));
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { packages, loading, error };
}
