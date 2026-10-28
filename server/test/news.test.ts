import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NewsItem } from '../../shared/api.ts';
import { cleanSummary, parseFeed, stripHtml } from '../src/news/rss.ts';
import { dedupe } from '../src/news/aggregate.ts';
import { classify, tagEntities } from '../src/news/classify.ts';
import { loadCatalog } from '../src/catalog/store.ts';
import { generation, seedDir } from './fixtures.ts';

const RSS = `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
<item><title><![CDATA[Porsche dévoile la nouvelle 911]]></title><link>https://ex.com/a</link><pubDate>Tue, 27 Oct 2026 10:00:00 +0000</pubDate>
<description><![CDATA[<p>La nouvelle 911 arrive &amp; change tout.</p>]]></description><media:content url="https://ex.com/a.jpg"/></item>
<item><title>Sans date</title><link>https://ex.com/b</link></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom</title><link rel="alternate" href="https://ex.com/c"/><updated>2026-10-27T08:00:00Z</updated><summary>Résumé</summary></entry></feed>`;

test('analyse RSS 2.0 : titre, lien, date, image et extrait nettoyé', () => {
  const [a, b] = parseFeed(RSS);
  assert.equal(a.title, 'Porsche dévoile la nouvelle 911');
  assert.equal(a.link, 'https://ex.com/a');
  assert.equal(a.publishedAt, '2026-10-27T10:00:00.000Z');
  assert.equal(a.image, 'https://ex.com/a.jpg');
  assert.equal(a.summary, 'La nouvelle 911 arrive & change tout.');
  assert.equal(b.publishedAt, null, 'aucune date inventée');
});

test('analyse Atom', () => {
  const [c] = parseFeed(ATOM);
  assert.equal(c.link, 'https://ex.com/c');
  assert.equal(c.summary, 'Résumé');
});

test('nettoyage : HTML doublement encodé et mentions automatiques retirés', () => {
  assert.equal(stripHtml('&#60;p&#62;Bonjour&#60;/p&#62;'), 'Bonjour');
  assert.equal(cleanSummary("Texte utile. L’article Titre est apparu en premier sur Site."), 'Texte utile.');
});

function item(id: string, title: string, source: 'manufacturer' | 'press', hoursAgo: number): NewsItem {
  return {
    id, title, summary: '', url: `https://ex.com/${id}`, image: null,
    publishedAt: new Date(Date.parse('2026-10-28T12:00:00Z') - hoursAgo * 3.6e6).toISOString(), eventDate: null,
    source: { id, name: id, type: source, homepage: 'https://ex.com' }, brands: [], models: [], categories: ['other'], alsoReportedBy: [], lang: 'fr',
  };
}

test('doublons regroupés, la source primaire (constructeur) reste en tête', () => {
  const out = dedupe([
    item('presse', 'BMW présente la nouvelle iX3 Neue Klasse', 'press', 1),
    item('bmw', 'BMW présente la nouvelle iX3 Neue Klasse à Munich', 'manufacturer', 2),
    item('autre', 'Le prix du carburant baisse', 'press', 1),
  ]);
  assert.equal(out.length, 2);
  const merged = out.find((n) => n.id === 'bmw')!;
  assert.deepEqual(merged.alsoReportedBy.map((a) => a.name), ['presse']);
});

test('classification par règles explicites', () => {
  assert.ok(classify('Rappel de 20 000 véhicules', '').includes('recalls'));
  assert.ok(classify('Nouvelle batterie : 500 km d’autonomie', '').includes('ev-batteries'));
  assert.deepEqual(classify('Bonjour', ''), ['other']);
});

test('marques reconnues par nom exact, modèles seulement avec leur marque', () => {
  loadCatalog(seedDir({ 'catalog-x.json': { generations: [generation('porsche-911', { modelName: '911' })] } }));
  assert.deepEqual(tagEntities('Porsche dévoile la 911', '').models.map((m) => m.id), ['porsche-911']);
  assert.deepEqual(tagEntities('Le vol 911 retardé', '').models, []);
  assert.deepEqual(tagEntities('Une bmw mini', '').brands, [], 'casse respectée : « bmw » minuscule ignoré');
});
