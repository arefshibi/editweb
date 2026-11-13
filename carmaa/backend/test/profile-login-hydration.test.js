import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const authUi = fs.readFileSync(path.resolve(here, '../../js/08-auth-modal-toast.js'), 'utf8');

test('OTP login hydrates all saved server profile fields instead of only the avatar', () => {
  assert.match(authUi, /function accountProfileFromAuthUser\(user, previous = \{\}\)/);
  for (const field of ['firstName', 'lastName', 'nickname', 'email', 'avatar', 'banner']) {
    assert.match(authUi, new RegExp(`${field}:`), `expected ${field} to be restored from the canonical user`);
  }
  assert.equal((authUi.match(/accountProfile: profileAtLoginHandoff\(window\.CARMA_AUTH_USER, state\.accountProfile\)/g) || []).length, 2,
    'both successful OTP login handoffs must restore the profile');
});

test('profile hydration clears stale form values when a server field is empty', () => {
  assert.match(authUi, /nickname: String\(user\.nickname \|\| ""\)/);
  assert.match(authUi, /email: String\(user\.email \|\| ""\)/);
  assert.match(authUi, /banner: user\.bannerUrl \|\| null/);
});
