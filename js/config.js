/* =====================================================================
   CONFIG — where the site finds its backend.

   The anon key is SAFE to commit: it only grants what the database's
   Row Level Security policies allow (read approved members, submit
   unapproved ones, cast votes, upload photos). All real power stays
   server-side in Supabase. (This is the JWT-format anon key rather than
   the newer sb_publishable_ key because Edge Functions require a JWT.)
   ===================================================================== */
const CONFIG = {
  SUPABASE_URL: "https://wsiqvmxoprninpoxwmni.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzaXF2bXhvcHJuaW5wb3h3bW5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0NzE5NzksImV4cCI6MjA2MzA0Nzk3OX0.in3dQTkM9U4AiH2SwYhMNUcO7hwq8KWXiPc5uagFkt4"
};
