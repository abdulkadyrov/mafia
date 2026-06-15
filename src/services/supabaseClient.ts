import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getSupabaseConfigError(): string | null {
  if (isSupabaseConfigured()) {
    return null;
  }

  return "Нет переменных окружения Supabase";
}

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error("Нет переменных окружения Supabase");
  }

  return supabase;
}
