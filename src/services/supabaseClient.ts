import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function getSupabaseConfigError(): string | null {
  if (isSupabaseConfigured()) {
    return null;
  }

  return "Нет переменных окружения Supabase";
}

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl as string, supabasePublishableKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: { eventsPerSecond: 20 },
      },
    })
  : null;

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error("Нет переменных окружения Supabase");
  }

  return supabase;
}
