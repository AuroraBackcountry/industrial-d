// INDUSTRIAL DATING — HR moderation endpoint.
//
// Password-gated (shared HR password, stored in industrial_dating_config,
// which has RLS enabled and no policies — only the service role reads it).
// Actions: list (pending members), approve, reject (delete row + photo).
// The password is checked server-side on every request; nothing about it
// ships in the static site.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Password check — server-side, every request.
  const { data: cfg } = await supabase.from("industrial_dating_config")
    .select("value").eq("key", "hr_password").single();
  if (!cfg || String(body.password ?? "") !== cfg.value) {
    await new Promise((r) => setTimeout(r, 500)); // dampen brute force a little
    return json({ error: "ACCESS DENIED. THIS ATTEMPT HAS BEEN NOTED IN YOUR FILE." }, 401);
  }

  const action = String(body.action ?? "");

  if (action === "list") {
    const { data, error } = await supabase.from("industrial_dating_members")
      .select("id,name,title,bio,tags,photo,spec,raw_notes,created_at")
      .eq("approved", false).order("created_at", { ascending: true });
    if (error) return json({ error: "list failed" }, 500);
    return json({ ok: true, members: data });
  }

  const id = String(body.id ?? "");
  if (!UUID_RE.test(id)) return json({ error: "valid id required" }, 400);

  if (action === "approve") {
    const { error } = await supabase.from("industrial_dating_members")
      .update({ approved: true }).eq("id", id);
    if (error) return json({ error: "approve failed" }, 500);
    return json({ ok: true });
  }

  if (action === "reject") {
    // Fetch first so we can clean up an uploaded photo.
    const { data: row } = await supabase.from("industrial_dating_members")
      .select("photo").eq("id", id).single();
    const { error } = await supabase.from("industrial_dating_members").delete().eq("id", id);
    if (error) return json({ error: "reject failed" }, 500);
    const marker = "/object/public/industrial-dating/";
    if (row?.photo && row.photo.includes(marker)) {
      const path = row.photo.split(marker)[1];
      if (path) await supabase.storage.from("industrial-dating").remove([path]);
    }
    return json({ ok: true });
  }

  return json({ error: "action must be list, approve, or reject" }, 400);
});
