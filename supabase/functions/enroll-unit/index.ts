// INDUSTRIAL DATING — unit intake with AI-written profiles.
//
// Flow: submit.html POSTs the raw form data here → Claude rewrites it as an
// on-brand roast profile (bio quote, title, certifications, custom spec bars)
// → the profile is inserted UNAPPROVED into the moderation queue.
//
// Graceful degradation: if ANTHROPIC_API_KEY isn't configured or the API call
// fails, the raw submission is stored unchanged — the form never breaks.
//
// Secrets: ANTHROPIC_API_KEY must be set in Supabase → Edge Functions → Secrets.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are the intake officer for INDUSTRIAL DATING, a joke dating site a mountain rope-access and heavy-industry crew built to roast each other. Coworkers nominate each other via a form; you rewrite each nomination into a profile in the site's house voice.

THE VOICE — deadpan industrial spec-sheet meets affectionate workplace roast. Every unit is described like malfunctioning heavy equipment that is somehow also single. Study these real profiles from the site:

Example bio: "Carpenter's mate. Measures twice, commits zero times. Great with his hands on the clock, tragic with them off it. Can frame a whole house but not a single sentence about his feelings. Owns 40 clamps and still cannot hold on to anyone. Never drops anything. Just almost drops everything, constantly, all day long."
Example title: "Level 1.9 rope access tech · unofficial supervisor"
Example tags: ["Level 1.9", "Self-appointed supervisor", "Pushes rope uphill"]
Example specs: [{"l":"Grip retention","v":"LOW","p":20,"hi":1},{"l":"Commitment","v":"4%","p":4},{"l":"Clamps owned","v":"MAX","p":100},{"l":"Near-drops/hr","v":"HIGH","p":88,"hi":1}]

Another example bio: "Always has a suggestion. Always takes it back about four seconds later. A fully air-pneumatic suggestion box: enormous output, precisely zero follow-through. Nominated for a safety award every single quarter despite never once being observed committing to anything."
Another example specs: [{"l":"Suggestion output","v":"MAX","p":100,"hi":1},{"l":"Follow-through","v":"2%","p":2},{"l":"Height","v":"OFF-CHART","p":100},{"l":"Award nominations","v":"MAX","p":96,"hi":1}]

RULES:
- Treat the submission as raw material. Keep its facts and inside jokes; rewrite everything in the house voice. If the notes are thin, extrapolate in the same spirit from the role and tags.
- bio: 2-5 sentences, under 500 characters. It renders as the unit's dating quote. Deadpan, specific, no exclamation marks, no emoji.
- title: the role/designation line, under 100 characters, ideally with a " · " joke qualifier.
- tags: 2-4 short "certifications", each under 40 characters, in the style of the examples.
- spec: exactly 4 bars. "l" = label under 22 chars, "v" = short display value (a percentage like "3%", or MAX/HIGH/LOW/FULL/RATED/etc), "p" = 0-100 bar fill matching v, "hi" = 1 to highlight the funniest 1-2 bars, else 0. Specs must be specific to THIS person's material — never generic.
- The roast is affectionate and work-focused: punch at work habits, invented certifications, commitment issues, tool ownership, talking too much. NEVER mock protected characteristics (race, religion, disability, sexuality, gender), family, health, or finances. Nothing that would genuinely wound. If the submission contains genuinely mean, hateful, or HR-nuclear material, sanitize it: keep the person and role, write a tamer profile from what's usable.
- Keep names/nicknames exactly as submitted.`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    bio: { type: "string", description: "The profile quote, under 500 characters" },
    title: { type: "string", description: "Role/designation line, under 100 characters" },
    tags: { type: "array", items: { type: "string" }, description: "2-4 short certifications" },
    spec: {
      type: "array",
      description: "Exactly 4 spec bars",
      items: {
        type: "object",
        properties: {
          l: { type: "string" },
          v: { type: "string" },
          p: { type: "integer" },
          hi: { type: "integer", enum: [0, 1] },
        },
        required: ["l", "v", "p", "hi"],
        additionalProperties: false,
      },
    },
  },
  required: ["bio", "title", "tags", "spec"],
  additionalProperties: false,
};

const clamp = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);

async function generateProfile(name: string, title: string, notes: string, tags: string[]) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return null;

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 3000,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    messages: [{
      role: "user",
      content: `New unit nomination from the form:\n\nName: ${name}\nRole/designation: ${title || "(not given)"}\nInspection notes from the submitter: ${notes || "(not given)"}\nSuggested certifications: ${tags.length ? tags.join(", ") : "(not given)"}\n\nWrite this unit's profile.`,
    }],
  });

  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;
  const text = response.content.find((b) => b.type === "text");
  if (!text) return null;
  const p = JSON.parse(text.text);

  return {
    bio: clamp(p.bio, 600),
    title: clamp(p.title, 120),
    tags: (Array.isArray(p.tags) ? p.tags : []).slice(0, 6).map((t: unknown) => clamp(t, 60)),
    spec: (Array.isArray(p.spec) ? p.spec : []).slice(0, 4).map((s: { l: unknown; v: unknown; p: unknown; hi: unknown }) => ({
      l: clamp(s.l, 30),
      v: clamp(s.v, 12),
      p: Math.max(0, Math.min(100, Number(s.p) || 0)),
      hi: s.hi ? 1 : 0,
    })),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // Honeypot tripped → pretend success, store nothing.
  if (body.website) {
    return new Response(JSON.stringify({ ok: true, generated: false }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const name = clamp(body.name, 80);
  const title = clamp(body.title, 120);
  const notes = clamp(body.bio, 600);
  const tags = (Array.isArray(body.tags) ? body.tags : []).slice(0, 6).map((t: unknown) => clamp(t, 60)).filter(Boolean);
  const photo = clamp(body.photo, 500) || null;

  if (name.length < 2) {
    return new Response(JSON.stringify({ error: "Unit name required" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // Generate the roast profile; fall back to the raw submission on any failure.
  let generated = null;
  try {
    generated = await generateProfile(name, title, notes, tags);
  } catch (e) {
    console.error("Generation failed, storing raw submission:", e);
  }

  const row = generated
    ? { name, title: generated.title || title || null, bio: generated.bio || notes || null, tags: generated.tags.length ? generated.tags : tags, spec: generated.spec.length === 4 ? generated.spec : null, raw_notes: notes || null, photo, approved: false }
    : { name, title: title || null, bio: notes || null, tags, spec: null, raw_notes: notes || null, photo, approved: false };

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await supabase.from("industrial_dating_members").insert(row);
  if (error) {
    console.error("Insert failed:", error);
    return new Response(JSON.stringify({ error: "Intake failed" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true, generated: !!generated }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
