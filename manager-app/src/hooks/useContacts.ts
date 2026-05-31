import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Contact } from '../types';
import toast from 'react-hot-toast';

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('contacts').select('*').order('name');
    if (error) {
      toast.error('Failed to load contacts');
      console.error(error);
    } else {
      setContacts((data as Contact[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = async (id: number, fields: Partial<Contact>) => {
    const { error } = await supabase.from('contacts').update(fields).eq('id', id);
    if (error) {
      toast.error('Failed to update contact');
      return false;
    }
    await refresh();
    return true;
  };

  return { contacts, loading, refresh, update };
}

interface ContactInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
}

/**
 * Find an existing contact by (lowercased) email or create a new one.
 * Keeps the contact's details fresh. Returns the contact id, or null on failure.
 * Email is normalized to lowercase so the lookup uses an exact, wildcard-safe match.
 */
export async function findOrCreateContact(input: ContactInput): Promise<number | null> {
  const email = input.email?.trim().toLowerCase() || null;

  if (email) {
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', email)
      .limit(1)
      .maybeSingle();

    if (existing) {
      const id = (existing as { id: number }).id;
      await supabase
        .from('contacts')
        .update({
          name: input.name,
          phone: input.phone ?? null,
          company: input.company ?? null,
        })
        .eq('id', id);
      return id;
    }
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      name: input.name,
      email,
      phone: input.phone ?? null,
      company: input.company ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('contact create error:', error.message);
    return null;
  }
  return (data as { id: number }).id;
}
