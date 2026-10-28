/**
 * Autoverse — registre des abonnements aux notifications push (Cloudflare Worker, offre gratuite).
 *
 * Le Worker ne fait qu'une chose : garder la liste des appareils abonnés et leurs sujets.
 * L'envoi des notifications est fait par GitHub Actions (scripts/send-push.ts), qui lit cette
 * liste avec un jeton secret. Aucune donnée personnelle : un abonnement push est une adresse
 * technique fournie par le navigateur, sans nom ni e-mail.
 *
 * Liaisons à configurer dans Cloudflare :
 *   - KV namespace  → variable « SUBSCRIPTIONS »
 *   - Secret        → « ADMIN_TOKEN » (identique au secret GitHub PUSH_ADMIN_TOKEN)
 *   - Variable      → « ALLOWED_ORIGIN » = https://<utilisateur>.github.io
 *
 * Routes :
 *   POST   /subscribe          { subscription, topics: string[], brands: string[] }  (public)
 *   POST   /unsubscribe        { endpoint }                                           (public)
 *   GET    /subscriptions      liste complète                                        (jeton)
 *   DELETE /subscriptions/:id  supprime un abonnement expiré                         (jeton)
 */
const TOPICS = ['releases', 'f1', 'wec', 'wrc'];
const MAX_BODY = 4096;

function cors(env, req) {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = (env.ALLOWED_ORIGIN ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] ?? '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

const json = (data, status, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });

async function idOf(endpoint) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

async function readBody(req) {
  const text = await req.text();
  if (text.length > MAX_BODY) throw new Error('requête trop volumineuse');
  return JSON.parse(text);
}

function isAdmin(req, env) {
  const auth = req.headers.get('Authorization') ?? '';
  return !!env.ADMIN_TOKEN && auth === `Bearer ${env.ADMIN_TOKEN}`;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const headers = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    try {
      if (req.method === 'POST' && url.pathname === '/subscribe') {
        const body = await readBody(req);
        const sub = body?.subscription;
        if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) {
          return json({ error: 'abonnement invalide' }, 400, headers);
        }
        const topics = (Array.isArray(body.topics) ? body.topics : []).filter((t) => TOPICS.includes(t));
        const brands = (Array.isArray(body.brands) ? body.brands : []).filter((b) => typeof b === 'string' && b.length <= 40).slice(0, 100);
        const id = await idOf(sub.endpoint);
        const record = { id, subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, topics, brands, updatedAt: new Date().toISOString() };
        await env.SUBSCRIPTIONS.put(id, JSON.stringify(record));
        return json({ id, topics }, 200, headers);
      }

      if (req.method === 'POST' && url.pathname === '/unsubscribe') {
        const body = await readBody(req);
        if (typeof body?.endpoint !== 'string') return json({ error: 'endpoint manquant' }, 400, headers);
        await env.SUBSCRIPTIONS.delete(await idOf(body.endpoint));
        return json({ ok: true }, 200, headers);
      }

      if (req.method === 'GET' && url.pathname === '/subscriptions') {
        if (!isAdmin(req, env)) return json({ error: 'non autorisé' }, 401);
        const out = [];
        let cursor;
        do {
          const page = await env.SUBSCRIPTIONS.list({ cursor });
          for (const k of page.keys) {
            const v = await env.SUBSCRIPTIONS.get(k.name);
            if (v) out.push(JSON.parse(v));
          }
          cursor = page.list_complete ? undefined : page.cursor;
        } while (cursor);
        return json(out, 200);
      }

      if (req.method === 'DELETE' && url.pathname.startsWith('/subscriptions/')) {
        if (!isAdmin(req, env)) return json({ error: 'non autorisé' }, 401);
        await env.SUBSCRIPTIONS.delete(url.pathname.split('/').pop());
        return json({ ok: true }, 200);
      }

      return json({ error: 'introuvable' }, 404, headers);
    } catch (e) {
      return json({ error: 'requête invalide' }, 400, headers);
    }
  },
};
