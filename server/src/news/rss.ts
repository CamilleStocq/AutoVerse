/** Analyse tolérante des flux RSS 2.0 et Atom vers une forme commune. */
import { XMLParser } from 'fast-xml-parser';

export interface RawItem {
  title: string;
  link: string;
  summary: string;
  publishedAt: string | null;
  image: string | null;
  categories: string[];
}

type Node = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '#text',
  processEntities: true,
  htmlEntities: true,
  trimValues: true,
});

const arr = <T>(x: T | T[] | undefined | null): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);

const text = (x: unknown): string => {
  if (x == null) return '';
  if (typeof x === 'string' || typeof x === 'number') return String(x);
  if (typeof x === 'object' && '#text' in (x as object)) return String((x as Node)['#text']);
  return '';
};

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

export function stripHtml(html: string): string {
  // Certains flux double-encodent le HTML (&#60;p&#62;) : on décode avant de retirer les balises.
  const decoded = decodeEntities(decodeEntities(html));
  return decodeEntities(
    decoded.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ').trim();
}

/** Retire les mentions automatiques ajoutées par certains CMS (« L'article … est apparu en premier sur … »). */
export function cleanSummary(s: string): string {
  return s
    .replace(/\s*(L[’']article .{0,300}? est apparu en premier sur .*|The post .{0,300}? appeared first on .*)$/i, '')
    .replace(/\s*\[(…|\.\.\.)\]\s*$/, '…')
    .trim();
}

export function truncate(s: string, max = 280): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${cut.slice(0, space > 200 ? space : max).replace(/[\s,;:.…-]+$/, '')}…`;
}

function firstImg(html: string): string | null {
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(decodeEntities(html));
  return m ? m[1] : null;
}

function imageOf(item: Node, html: string): string | null {
  for (const key of ['media:content', 'media:thumbnail', 'enclosure', 'media:group']) {
    for (const m of arr(item[key] as Node | Node[])) {
      const nested = m['media:content'];
      if (nested) {
        const n = arr(nested as Node | Node[])[0];
        if (n?.['@url']) return String(n['@url']).trim();
      }
      const url = m['@url'];
      const type = String(m['@type'] ?? 'image');
      if (url && (type.startsWith('image') || key !== 'enclosure')) return String(url).trim();
    }
  }
  return firstImg(html);
}

const toIso = (s: string): string | null => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export function parseFeed(xml: string): RawItem[] {
  const doc = parser.parse(xml) as { rss?: { channel?: Node }; feed?: Node };
  const channel = doc.rss?.channel;
  if (channel) {
    return arr(channel.item as Node | Node[]).map((it) => {
      const html = text(it['content:encoded']) || text(it.description) || text(it['pp:summary']);
      const lead = text(it.description) || text(it['pp:subtitle']) || text(it['pp:summary']) || html;
      return {
        title: stripHtml(text(it.title)),
        link: (text(it.link) || text(it.guid)).trim(),
        summary: truncate(cleanSummary(stripHtml(lead))),
        publishedAt: toIso(text(it.pubDate) || text(it['dc:date'])),
        image: imageOf(it, html),
        categories: arr(it.category).map(text).filter(Boolean),
      };
    });
  }
  if (doc.feed) {
    return arr(doc.feed.entry as Node | Node[]).map((it) => {
      const links = arr(it.link as Node | Node[]);
      const link = links.find((l) => !l['@rel'] || l['@rel'] === 'alternate')?.['@href'];
      const html = text(it.content) || text(it.summary);
      return {
        title: stripHtml(text(it.title)),
        link: String(link ?? ''),
        summary: truncate(cleanSummary(stripHtml(text(it.summary) || html))),
        publishedAt: toIso(text(it.published) || text(it.updated)),
        image: imageOf(it, html),
        categories: arr(it.category as Node | Node[]).map((c) => String(c['@term'] ?? text(c))).filter(Boolean),
      };
    });
  }
  return [];
}
