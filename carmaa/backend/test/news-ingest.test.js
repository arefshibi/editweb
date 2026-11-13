import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgres://u:p@localhost:5432/x';
process.env.REDIS_URL ||= 'redis://localhost:6379';
process.env.OTP_PEPPER ||= 'a'.repeat(40);
process.env.SESSION_PEPPER ||= 'b'.repeat(40);
const { parseFeed, parseFeeds } = await import('../src/services/news-ingest.js');

test('parseFeed reads RSS items and Atom entries, decoding entities and CDATA', () => {
  const rss = `<rss><channel><item><title><![CDATA[Ford recalls 102,000 trucks &amp; vans]]></title><link>https://www.kbb.com/car-news/ford-recall/</link><description><![CDATA[<p>Display fault.</p>]]></description><pubDate>Tue, 21 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
  const [a] = parseFeed(rss);
  assert.equal(a.title, 'Ford recalls 102,000 trucks & vans');
  assert.equal(a.link, 'https://www.kbb.com/car-news/ford-recall/');
  assert.equal(a.description, 'Display fault.');
  assert.equal(a.published.toISOString(), '2026-10-21T10:00:00.000Z');
  const atom = `<feed><entry><title>New EV</title><link href="https://www.elektroquatsch.de/artikel/x"/><summary>Short</summary><updated>2026-10-20T08:00:00Z</updated></entry></feed>`;
  assert.equal(parseFeed(atom)[0].link, 'https://www.elektroquatsch.de/artikel/x');
  assert.equal(parseFeed('<rss><item><title>No date</title><link>https://x.y/</link></item></rss>').length, 0);
});

test('parseFeeds accepts only named https feeds', () => {
  const f = parseFeeds('KBB|https://www.kbb.com/car-news/feed/,Bad|http://x.y/feed,|https://z.z/feed,Nope');
  assert.deepEqual(f.map((x) => x.name), ['KBB']);
});
