import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Use sessionStorage so each browser tab has its own isolated auth session.
// This lets you run employee + vendor sessions side-by-side in separate tabs
// without them overwriting each other (localStorage is shared across all tabs).
export const supabase = createClient(url, anonKey, {
  auth: {
    storage: window.sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
