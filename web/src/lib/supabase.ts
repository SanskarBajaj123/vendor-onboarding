import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Give each browser tab its own auth namespace so different accounts
// can be logged in simultaneously across tabs. The tab ID lives in
// sessionStorage (tab-scoped), but the token itself stays in localStorage
// under a tab-specific key — so login works normally and each tab is isolated.
const TAB_KEY = "vo-tab-id";
let tabId = sessionStorage.getItem(TAB_KEY);
if (!tabId) {
  tabId = Math.random().toString(36).slice(2, 10);
  sessionStorage.setItem(TAB_KEY, tabId);
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storageKey: `sb-session-${tabId}`,
    persistSession: true,
    autoRefreshToken: true,
  },
});
