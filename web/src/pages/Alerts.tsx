import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, CalendarClock, Flag } from 'lucide-react';
import type { AppEvent, EventTopic } from '@shared/api';
import { ALL_TOPICS, useAlertSettings, useMyEvents } from '../state/alerts';
import { currentSubscription, disablePush, enablePush, pushConfigured, pushSupport, updatePushTopics } from '../lib/push';
import { useUi } from '../state/UiProvider';
import { EmptyState, ErrorState } from '../components/States';
import { formatDate, timeAgo } from '../lib/format';

const TOPIC_STYLE: Record<EventTopic, { label: string; color: string }> = {
  releases: { label: 'Sortie', color: 'var(--accent)' },
  f1: { label: 'F1', color: 'var(--f1)' },
  wec: { label: 'WEC', color: 'var(--wec)' },
  wrc: { label: 'WRC', color: 'var(--wrc)' },
};

function PushControls() {
  const { settings, update } = useAlertSettings();
  const { brands } = useMyEvents();
  const { toast } = useUi();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const support = pushSupport();
  const pushBrands = settings.myBrandsOnly ? brands : [];

  useEffect(() => { currentSubscription().then((s) => setSubscribed(!!s)).catch(() => setSubscribed(false)); }, []);

  const save = async (patch: Partial<typeof settings>) => {
    update(patch);
    const next = { ...settings, ...patch };
    if (subscribed) {
      try {
        await updatePushTopics(next.topics, next.myBrandsOnly ? brands : []);
      } catch (e) {
        setError((e as Error).message);
      }
    }
  };

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (subscribed) {
        await disablePush();
        setSubscribed(false);
        toast('Notifications désactivées sur cet appareil');
      } else {
        await enablePush(settings.topics, pushBrands);
        setSubscribed(true);
        toast('Notifications activées');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel stack gap-4">
      <div className="row between wrap gap-3">
        <div className="stack gap-1">
          <h3 style={{ margin: 0 }}>Notifications sur cet appareil</h3>
          <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            {!pushConfigured ? 'Le service d’envoi n’est pas encore configuré : les alertes restent visibles ci-dessous.'
              : support === 'ios-needs-install' ? 'Sur iPhone et iPad : ajoutez d’abord Autoverse à l’écran d’accueil (Partager → Sur l’écran d’accueil), puis ouvrez-la depuis son icône.'
                : support === 'unsupported' ? 'Ce navigateur ne permet pas les notifications push.'
                  : subscribed ? 'Activées : vous serez prévenu même application fermée.' : 'Désactivées.'}
          </span>
        </div>
        {pushConfigured && support === 'ok' && subscribed !== null && (
          <button type="button" className={subscribed ? 'btn btn-sm' : 'btn btn-primary btn-sm'} onClick={toggle} disabled={busy}>
            {subscribed ? <><BellOff size={16} /> Désactiver</> : <><Bell size={16} /> Activer les notifications</>}
          </button>
        )}
      </div>
      {error && <p role="alert" style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>{error}</p>}
      <fieldset className="ob-fieldset">
        <legend className="label">Me prévenir pour</legend>
        <div className="topic-list">
          {ALL_TOPICS.map((t) => {
            const on = settings.topics.includes(t.id);
            return (
              <label key={t.id} className="topic-row" style={{ '--topic': TOPIC_STYLE[t.id].color } as CSSProperties}>
                <input type="checkbox" checked={on} onChange={() => save({ topics: on ? settings.topics.filter((x) => x !== t.id) : [...settings.topics, t.id] })} />
                <span className="stack">
                  <strong>{t.label}</strong>
                  <span className="subtle" style={{ fontSize: 'var(--text-xs)' }}>{t.description}</span>
                </span>
              </label>
            );
          })}
        </div>
        {settings.topics.includes('releases') && (
          <label className="row gap-2" style={{ fontSize: 'var(--text-sm)' }}>
            <input type="checkbox" checked={settings.myBrandsOnly} disabled={!brands.length} onChange={() => save({ myBrandsOnly: !settings.myBrandsOnly })} />
            Sorties : uniquement mes marques{brands.length ? ` (${brands.length})` : ' — choisissez des marques dans votre profil'}
          </label>
        )}
      </fieldset>
    </section>
  );
}

function EventRow({ e, isNew }: { e: AppEvent; isNew: boolean }) {
  const s = TOPIC_STYLE[e.topic];
  return (
    <li>
      <Link to={`/${e.url}`} className="alert-row" style={{ '--topic': s.color } as CSSProperties}>
        <span className="alert-icon" aria-hidden="true">{e.topic === 'releases' ? <CalendarClock size={18} /> : <Flag size={18} />}</span>
        <span className="stack" style={{ minWidth: 0 }}>
          <span className="row gap-2 wrap">
            <span className="alert-tag">{s.label}</span>
            {isNew && <span className="badge accent">Nouveau</span>}
          </span>
          <strong>{e.title}</strong>
          {e.body && <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>{e.body}</span>}
        </span>
        <time className="subtle num" dateTime={e.createdAt} title={formatDate(e.createdAt, { dateStyle: 'full', timeStyle: 'short' })}>{timeAgo(e.createdAt)}</time>
      </Link>
    </li>
  );
}

export function Alerts() {
  const { events, isLoading, isError, refetch, data } = useMyEvents();
  const { settings, update } = useAlertSettings();
  // Mémorise les alertes « non lues » à l'ouverture, puis les marque comme vues.
  const [seenBefore] = useState(settings.lastSeen);
  useEffect(() => {
    if (data) update({ lastSeen: new Date().toISOString() });
  }, [data, update]);

  return (
    <div className="page-enter settings">
      <header className="page-head">
        <span className="eyebrow">Alertes</span>
        <h1>Alertes</h1>
        <p>Nouvelles dates de sortie et résultats F1, WEC et WRC, détectés automatiquement à chaque mise à jour des données (toutes les 30 minutes environ).</p>
      </header>
      <PushControls />
      <section className="stack gap-3">
        <h2 className="section-head" style={{ margin: 0, fontSize: 'var(--text-xl)', textTransform: 'uppercase' }}>Dernières alertes</h2>
        {isLoading ? <div className="skeleton" style={{ height: 160 }} /> : isError ? (
          <ErrorState message="Les alertes ne sont pas disponibles pour le moment." onRetry={() => refetch()} />
        ) : events.length ? (
          <ul className="alert-list">{events.map((e) => <EventRow key={e.id} e={e} isNew={!seenBefore || e.createdAt > seenBefore} />)}</ul>
        ) : (
          <EmptyState icon={<Bell size={28} />} title="Aucune alerte pour l’instant" message="Dès qu’une date de sortie est annoncée ou qu’un résultat tombe, il apparaîtra ici." />
        )}
      </section>
    </div>
  );
}
