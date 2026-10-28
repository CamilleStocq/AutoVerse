import { ExternalLink, Newspaper } from 'lucide-react';
import type { NewsItem } from '@shared/api';
import { NEWS_CATEGORY_LABELS } from '@shared/labels';
import { Link } from 'react-router-dom';
import { formatDate, timeAgo } from '../lib/format';
import { useState } from 'react';

export function NewsCard({ item, compact }: { item: NewsItem; compact?: boolean }) {
  const [imgOk, setImgOk] = useState(!!item.image);
  return (
    <article className="news-card">
      <a href={item.url} target="_blank" rel="noreferrer" className="news-media" tabIndex={-1} aria-hidden="true">
        {imgOk && item.image
          ? <img src={item.image} alt="" loading="lazy" decoding="async" onError={() => setImgOk(false)} referrerPolicy="no-referrer" />
          : <div className="news-fallback"><Newspaper size={28} /><span>{item.source.name}</span></div>}
      </a>
      <div className="news-body">
        <div className="row gap-2 wrap">
          <span className={`badge plain ${item.source.type === 'manufacturer' ? 'info' : 'neutral'}`}>
            {item.source.type === 'manufacturer' ? 'Source officielle' : 'Presse'}
          </span>
          {item.categories.filter((c) => c !== 'other').slice(0, compact ? 1 : 2).map((c) => (
            <span key={c} className="badge plain neutral">{NEWS_CATEGORY_LABELS[c]}</span>
          ))}
        </div>
        <h3>
          <a href={item.url} target="_blank" rel="noreferrer">{item.title}<ExternalLink size={14} aria-label="(nouvel onglet)" className="ext" /></a>
        </h3>
        {!compact && item.summary && <p className="muted news-summary">{item.summary}</p>}
        {!!item.models.length && (
          <div className="row gap-2 wrap">
            {item.models.slice(0, 3).map((m) => (
              <Link key={m.id} to={`/voiture/${m.id}`} className="chip" style={{ minHeight: 28, fontSize: 12, position: 'relative', zIndex: 2 }}>{m.name}</Link>
            ))}
          </div>
        )}
        <p className="provenance">
          <span>{item.source.name}</span>
          <span>· Publié <time dateTime={item.publishedAt} title={formatDate(item.publishedAt, { dateStyle: 'full', timeStyle: 'short' })}>{timeAgo(item.publishedAt)}</time></span>
          {!!item.alsoReportedBy.length && <span>· Repris par {item.alsoReportedBy.map((a) => a.name).join(', ')}</span>}
          {item.lang === 'en' && <span>· Article en anglais</span>}
        </p>
      </div>
    </article>
  );
}

export function NewsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="news-grid" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="news-card">
          <div className="news-media"><div className="skeleton" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} /></div>
          <div className="news-body"><div className="skeleton" style={{ height: 18, width: '80%' }} /><div className="skeleton" style={{ height: 14, width: '50%' }} /></div>
        </div>
      ))}
    </div>
  );
}
