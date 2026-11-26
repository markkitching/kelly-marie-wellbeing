// Cloudflare Pages Function at /api/plan: emails the cost calculator's personal plan.
// Cloudflare builds and runs everything in functions/ alongside the static site. The
// work is done in src/lib/plan-handler.js, where it can be tested with Node.
import handler from "../../src/lib/plan-handler.js";

export const onRequestPost = ({ request, env }) => handler.handle(request, env);

export const onRequest = () =>
  new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json", Allow: "POST" },
  });
