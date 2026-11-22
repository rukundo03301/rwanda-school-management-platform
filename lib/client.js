import { createClient } from "@supabase/supabase-js";
let singleton;
export function browserSupabase() {
  if (typeof window === "undefined") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  if (!singleton) singleton = createClient(url,key);
  return singleton;
}
