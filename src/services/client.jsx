import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_KEY;

export const client = createClient(supabaseUrl, supabaseAnonKey);

export const parseData = ({ data, error }) => {
    if (error) throw error;

    return data;
};
