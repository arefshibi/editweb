import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const routes = fs.readFileSync(path.resolve(here, '../src/routes/social.js'), 'utf8');
const client = fs.readFileSync(path.resolve(here, '../../js/00-api-client.js'), 'utf8');
const stories = fs.readFileSync(path.resolve(here, '../../js/27-stories.js'), 'utf8');
const styles = fs.readFileSync(path.resolve(here, '../../styles.css'), 'utf8');

test('story viewer list is authenticated and limited to the owner of the active story', () => {
  assert.match(routes, /router\.get\('\/stories\/:id\/viewers', authRequired/);
  assert.match(routes, /WHERE id=\$1 AND owner_id=\$2 AND expires_at>now\(\)/);
  assert.match(routes, /res\.set\('Cache-Control','private, no-store'\)/);
  assert.match(routes, /JOIN users u ON u\.id=v\.viewer_id/);
  assert.doesNotMatch(routes.match(/router\.get\('\/stories\/:id\/viewers'[\s\S]*?\n\}\);/)?.[0] || '', /phone|email|device_digest/);
});

test('story viewer API and upward swipe open the viewer sheet only for own stories', () => {
  assert.match(client, /storyViewers\(id\).*\/viewers/);
  assert.match(stories, /dy < -70[\s\S]{0,120}queue\[gi\]\?\.mine/);
  assert.match(stories, /function openViewersSheet\(\)/);
  assert.match(stories, /social\.storyViewers\(story\.id\)/);
  assert.match(stories, /data-sv="viewers"/);
  assert.match(styles, /\.mr-sv-viewers-sheet/);
});
