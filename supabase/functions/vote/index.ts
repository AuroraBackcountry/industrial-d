// INDUSTRIAL DATING — voting endpoint.
//
// Votes are toggleable: cast, switch, or retract. Each browser holds a random
// anonymous voter_id (localStorage); one vote per unit per voter, and only
// the holder of a voter_id can change its votes. All writes go through the
// service role — there is no direct client write path to the votes table.

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

  const memberKey = String(body.member_key ?? "").trim().slice(0, 100);
  const vote = String(body.vote ?? "");
  const voterId = String(body.voter_id ?? "");

  if (!memberKey) return json({ error: "member_key required" }, 400);
  if (!UUID_RE.test(voterId)) return json({ error: "voter_id must be a UUID" }, 400);
  if (!["certify", "redtag", "retract"].includes(vote)) return json({ error: "vote must be certify, redtag, or retract" }, 400);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Cast and switch both start by clearing this voter's existing vote on the unit.
  const del = await supabase.from("industrial_dating_votes").delete()
    .eq("member_key", memberKey).eq("voter_id", voterId);
  if (del.error) {
    console.error("delete failed:", del.error);
    return json({ error: "vote failed" }, 500);
  }

  if (vote !== "retract") {
    const ins = await supabase.from("industrial_dating_votes")
      .insert({ member_key: memberKey, vote, voter_id: voterId });
    if (ins.error) {
      console.error("insert failed:", ins.error);
      return json({ error: "vote failed" }, 500);
    }
  }

  return json({ ok: true });
});
