import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  var supabaseClientSingleton: SupabaseClient | undefined;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase 환경변수가 없습니다. .env.local에 SUPABASE_URL, SUPABASE_ANON_KEY를 설정하세요.",
  );
}

export const supabaseClient: SupabaseClient =
  global.supabaseClientSingleton ??
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
  });

if (process.env.NODE_ENV !== "production") {
  global.supabaseClientSingleton = supabaseClient;
}
