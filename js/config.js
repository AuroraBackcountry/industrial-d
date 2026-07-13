/* =====================================================================
   CONFIG — where the site finds its backend.

   The publishable key is SAFE to commit: it only grants what the
   database's Row Level Security policies allow (read approved members,
   submit unapproved ones, cast votes, upload photos). All real power
   stays server-side in Supabase.
   ===================================================================== */
const CONFIG = {
  SUPABASE_URL: "https://wsiqvmxoprninpoxwmni.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_DxAHvU39Mr3EdAos4Hx1sw_Gus8DgGz"
};
