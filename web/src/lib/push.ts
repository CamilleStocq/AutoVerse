/**
 * Notifications push (Web Push) : abonnement de l'appareil auprès du registre (Worker Cloudflare).
 * Les clés publiques sont fournies au build par GitHub (variables VITE_PUSH_API_URL, VITE_VAPID_PUBLIC_KEY).
 */
import type { EventTopic } from '@shared/api';

const API = (import.meta.env.VITE_PUSH_API_URL as string | undefined)?.replace(/\/$/, '');
const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export const pushConfigured = !!API && !!VAPID;

export function pushSupport(): 'ok' | 'unsupported' | 'ios-needs-install' {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // Sur iPhone / iPad, Safari n'autorise les notifications qu'aux applications ajoutées à l'écran d'accueil.
  if (ios && !standalone) return 'ios-needs-install';
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window ? 'ok' : 'unsupported';
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  if (reg) return reg;
  return navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushConfigured || pushSupport() !== 'ok') return null;
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  return (await reg?.pushManager.getSubscription()) ?? null;
}

async function register(sub: PushSubscription, topics: EventTopic[], brands: string[]) {
  const res = await fetch(`${API}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), topics, brands }),
  });
  if (!res.ok) throw new Error('Le service de notifications ne répond pas. Réessayez dans un instant.');
}

/** Demande l'autorisation, abonne l'appareil et enregistre ses sujets. */
export async function enablePush(topics: EventTopic[], brands: string[]): Promise<void> {
  if (!pushConfigured) throw new Error('Les notifications push ne sont pas encore configurées pour cette application.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Autorisation refusée. Vous pouvez la réactiver dans les réglages du navigateur pour ce site.');
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID!) }));
  await register(sub, topics, brands);
}

/** Met à jour les sujets d'un appareil déjà abonné. */
export async function updatePushTopics(topics: EventTopic[], brands: string[]): Promise<void> {
  const sub = await currentSubscription();
  if (sub) await register(sub, topics, brands);
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await fetch(`${API}/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => undefined);
  await sub.unsubscribe();
}
