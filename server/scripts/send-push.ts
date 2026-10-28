/**
 * Envoi des notifications push pour les nouvelles alertes détectées par export-static.ts.
 * Exécuté par GitHub Actions après la publication du site :
 *   node scripts/send-push.ts <fichier des nouvelles alertes>
 *
 * Variables (secrets GitHub) : PUSH_API_URL, PUSH_ADMIN_TOKEN, VAPID_PUBLIC_KEY,
 * VAPID_PRIVATE_KEY, APP_URL (adresse publique de l'application), VAPID_SUBJECT (facultatif).
 */
import { readFileSync } from 'node:fs';
import webpush from 'web-push';
import type { AppEvent, EventTopic } from '../../shared/api.ts';

interface SubscriptionRecord {
  id: string;
  subscription: webpush.PushSubscription;
  topics: EventTopic[];
  brands: string[];
}

const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`variable ${name} manquante`);
  return v;
};

/** Sujets et marques choisis par l'abonné (les sorties peuvent être limitées à ses marques). */
export function eventsFor(sub: Pick<SubscriptionRecord, 'topics' | 'brands'>, events: AppEvent[]): AppEvent[] {
  return events.filter((e) => sub.topics.includes(e.topic)
    && (e.topic !== 'releases' || !sub.brands.length || (e.brandId != null && sub.brands.includes(e.brandId))));
}

/** Jusqu'à 3 notifications détaillées ; au-delà, une notification de synthèse. */
export function payloadsFor(events: AppEvent[], appUrl: string) {
  const one = (e: AppEvent) => ({ title: e.title, body: e.body, url: `${appUrl}${e.url}`, tag: e.id });
  if (events.length <= 3) return events.map(one);
  return [{
    title: `${events.length} nouvelles alertes Autoverse`,
    body: events.slice(0, 4).map((e) => e.title).join(' · '),
    url: `${appUrl}alertes`,
    tag: `digest-${events[0].id}`,
  }];
}

async function main() {
  const file = process.argv[2];
  const events = JSON.parse(readFileSync(file, 'utf8')) as AppEvent[];
  if (!events.length) {
    console.log('[push] aucune nouvelle alerte');
    return;
  }
  const api = env('PUSH_API_URL').replace(/\/$/, '');
  const token = env('PUSH_ADMIN_TOKEN');
  const appUrl = env('APP_URL').replace(/\/?$/, '/');
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? appUrl, env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));

  const res = await fetch(`${api}/subscriptions`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`registre des abonnements : HTTP ${res.status}`);
  const subs = (await res.json()) as SubscriptionRecord[];

  let sent = 0;
  let removed = 0;
  for (const sub of subs) {
    for (const payload of payloadsFor(eventsFor(sub, events), appUrl)) {
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify(payload), { TTL: 24 * 3600, urgency: 'normal' });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Abonnement expiré (application désinstallée, autorisation retirée) : on le supprime.
          await fetch(`${api}/subscriptions/${sub.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
          removed++;
          break;
        }
        console.warn(`[push] échec pour ${sub.id} : ${status ?? (e as Error).message}`);
      }
    }
  }
  console.log(`[push] ${events.length} alerte(s), ${subs.length} abonné(s), ${sent} notification(s) envoyée(s), ${removed} abonnement(s) expiré(s) supprimé(s)`);
}

// Exécution directe uniquement (les fonctions ci-dessus sont aussi importées par les tests).
if (process.argv[1]?.endsWith('send-push.ts')) {
  main().catch((e) => {
    console.error('[push]', e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
