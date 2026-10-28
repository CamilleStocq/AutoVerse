import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Download, Moon, Monitor, RefreshCw, Sun, Upload } from 'lucide-react';
import { CATEGORY_LABELS, INTEREST_LABELS, MARKETS, PERIOD_LABELS, POWERTRAIN_LABELS, PRICE_RANGE_LABELS, USAGE_LABELS } from '@shared/labels';
import type { MarketCode } from '@shared/types';
import { useMeta } from '../hooks/queries';
import { SERVER_SYNC, useProfile } from '../state/ProfileProvider';
import { useUi, type Theme } from '../state/UiProvider';
import { ApiError } from '../lib/api';
import { InstallPanel } from '../components/InstallApp';

function Row({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="pref-row">
      <dt>{label}</dt>
      <dd>{values.length ? values.join(', ') : <span className="subtle">Sans préférence</span>}</dd>
    </div>
  );
}

export function Settings() {
  const { preferences, savePreferences, profileId, syncState, linkProfile, wishlist, exportData, importData } = useProfile();
  const { theme, setTheme, toast } = useUi();
  const meta = useMeta();
  const [linkId, setLinkId] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const brandNames = preferences.brands === 'all'
    ? ['Toutes les marques']
    : preferences.brands.map((id) => meta.data?.brands.find((b) => b.id === id)?.name ?? id);

  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `autoverse-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const restoreBackup = async (file: File) => {
    try {
      const n = importData(JSON.parse(await file.text()));
      setImportMsg({ ok: true, text: `Sauvegarde restaurée : préférences et ${n} favori${n > 1 ? 's' : ''}.` });
    } catch (e) {
      setImportMsg({ ok: false, text: e instanceof SyntaxError ? 'Ce fichier est illisible.' : (e as Error).message });
    }
  };

  const doLink = async () => {
    setLinkError(null);
    try {
      await linkProfile(linkId);
      toast('Profil synchronisé sur cet appareil');
      setLinkId('');
    } catch (e) {
      setLinkError(e instanceof ApiError && e.status === 404
        ? 'Aucun profil ne correspond à cet identifiant. Vérifiez-le sur votre autre appareil.'
        : e instanceof ApiError && e.status === 400 ? 'Cet identifiant n’a pas le bon format.' : 'Connexion au serveur impossible. Réessayez dans un instant.');
    }
  };

  return (
    <div className="page-enter settings">
      <header className="page-head">
        <span className="eyebrow">Profil</span>
        <h1>Profil et paramètres</h1>
        <p>Vos préférences orientent le catalogue, l’accueil et l’actualité. Elles restent modifiables à tout moment.</p>
      </header>

      <InstallPanel />

      <section className="panel">
        <div className="row between wrap gap-3">
          <h3 style={{ margin: 0 }}>Mon univers automobile</h3>
          <Link to="/profil/preferences" className="btn btn-sm">Modifier mes préférences</Link>
        </div>
        <dl className="pref-list">
          <Row label="Marques" values={brandNames} />
          <Row label="Catégories" values={preferences.categories.map((c) => CATEGORY_LABELS[c])} />
          <Row label="Motorisation" values={preferences.powertrains.map((p) => POWERTRAIN_LABELS[p])} />
          <Row label="Gamme de prix" values={preferences.priceRanges.map((p) => PRICE_RANGE_LABELS[p])} />
          <Row label="Période" values={preferences.periods.map((p) => PERIOD_LABELS[p])} />
          <Row label="Usage" values={preferences.usages.map((u) => USAGE_LABELS[u])} />
          <Row label="Centres d’intérêt" values={preferences.interests.map((i) => INTEREST_LABELS[i])} />
        </dl>
      </section>

      <section className="panel">
        <h3>Marché</h3>
        <p className="muted" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>Détermine la devise, les prix et la disponibilité affichés.</p>
        <select className="select" style={{ maxWidth: 320 }} aria-label="Marché" value={preferences.market} onChange={(e) => { savePreferences({ ...preferences, market: e.target.value as MarketCode }); toast('Marché mis à jour'); }}>
          {MARKETS.map((m) => <option key={m.code} value={m.code}>{m.name} ({m.currency})</option>)}
        </select>
      </section>

      <section className="panel">
        <h3>Apparence</h3>
        <div className="segmented" role="group" aria-label="Thème">
          {([['dark', 'Sombre', Moon], ['light', 'Clair', Sun], ['system', 'Système', Monitor]] as Array<[Theme, string, typeof Moon]>).map(([k, l, Icon]) => (
            <button key={k} type="button" aria-pressed={theme === k} onClick={() => setTheme(k)}><Icon size={16} /> {l}</button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Sauvegarde et synchronisation</h3>
        {SERVER_SYNC ? (
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Vos préférences et vos {wishlist.length} favori{wishlist.length > 1 ? 's' : ''} sont enregistrés sur cet appareil et sur le serveur Autoverse.
            État : <strong style={{ color: syncState === 'pending' ? 'var(--warning)' : 'var(--positive)' }}>{syncState === 'synced' ? 'synchronisé' : syncState === 'syncing' ? 'synchronisation…' : 'en attente de connexion'}</strong>
          </p>
        ) : (
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Vos préférences et vos {wishlist.length} favori{wishlist.length > 1 ? 's' : ''} sont enregistrés durablement sur cet appareil, sans compte.
            Pour les retrouver sur un autre téléphone ou ordinateur, exportez-les ici puis importez le fichier là-bas.
          </p>
        )}
        <div className="row gap-2 wrap" style={{ marginTop: 'var(--space-4)' }}>
          <button type="button" className="btn btn-sm" onClick={downloadBackup}><Download size={16} /> Exporter mes données</button>
          <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
            <Upload size={16} /> Importer une sauvegarde
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) restoreBackup(f); e.target.value = ''; }} />
          </label>
        </div>
        {importMsg && <p role="status" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)', color: importMsg.ok ? 'var(--positive)' : 'var(--danger)' }}>{importMsg.text}</p>}
        {SERVER_SYNC && <>
        <div className="field" style={{ marginTop: 'var(--space-4)' }}>
          <span className="label">Identifiant de ce profil</span>
          <div className="row gap-2">
            <code className="profile-id">{profileId}</code>
            <button type="button" className="icon-btn" aria-label="Copier l’identifiant" data-tip="Copier" onClick={() => navigator.clipboard?.writeText(profileId).then(() => toast('Identifiant copié'), () => toast('Copie impossible'))}><Copy size={16} /></button>
          </div>
          <span className="subtle" style={{ fontSize: 'var(--text-xs)' }}>Saisissez-le sur un autre appareil pour y retrouver le même profil. Gardez-le pour vous : il donne accès à vos préférences et favoris.</span>
        </div>
        <div className="field" style={{ marginTop: 'var(--space-4)' }}>
          <label htmlFor="link-id">Utiliser le profil d’un autre appareil</label>
          <div className="row gap-2 wrap">
            <input id="link-id" className="input num" style={{ flex: 1, minWidth: 240 }} value={linkId} onChange={(e) => { setLinkId(e.target.value); setLinkError(null); }} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            <button type="button" className="btn" disabled={linkId.trim().length < 36} onClick={doLink}><RefreshCw size={16} /> Synchroniser</button>
          </div>
          {linkError && <span role="alert" style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>{linkError}</span>}
          <span className="subtle" style={{ fontSize: 'var(--text-xs)' }}>Les favoris de cet appareil seront remplacés par ceux du profil choisi.</span>
        </div>
        </>}
      </section>

      <section className="panel">
        <h3>Fonctionnalités à venir</h3>
        <ul className="bullet-list muted" style={{ fontSize: 'var(--text-sm)' }}>
          <li>Notifications (sorties, nouvelles générations, actualité de la wishlist) — <em>non encore disponibles</em>.</li>
          <li>Collections personnelles et calendrier personnel exportable — <em>non encore disponibles</em>.</li>
          {!SERVER_SYNC && <li>Synchronisation automatique entre appareils — <em>non disponible dans la version en ligne</em> (utilisez l’export / import).</li>}
        </ul>
        <p className="row gap-2 subtle" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-3)' }}><Check size={14} /> Disponible dès maintenant : export de la wishlist (JSON), partage de fiche, recommandations similaires.</p>
      </section>
    </div>
  );
}
