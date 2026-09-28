const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function harness(handler, initial = null) {
  let stored = initial;
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('src/session.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, Headers, Response, JSON, console,
    fetch: handler,
    require(name) {
      if (name === './config') return { API_URL: 'https://api.test' };
      if (name === 'react') return { useSyncExternalStore: (_, snapshot) => snapshot() };
      if (name === 'expo-secure-store') return {
        getItemAsync: async () => stored,
        setItemAsync: async (_, value) => { stored = value; },
        deleteItemAsync: async () => { stored = null; },
      };
      throw new Error(name);
    },
  });
  return { session: module.exports, stored: () => stored };
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const pair = { access: 'old-access', refresh: 'old-refresh' };

test('anonymous production session requires sign-in; demo is explicit', async () => {
  for (const demo of [false, true]) {
    const h = harness(async () => json({ demo_mode: demo }));
    await h.session.initializeSession();
    const state = h.session.useSession();
    assert.equal(state.ready, true);
    assert.equal(state.signedIn, false);
    assert.equal(state.demo, demo);
  }
});

test('corrupt saved credentials do not trap the user on the loading screen', async () => {
  const h = harness(async () => json({ demo_mode: false }), '{bad-json');
  await h.session.initializeSession();
  assert.equal(h.session.useSession().ready, true);
  assert.equal(h.session.useSession().signedIn, false);
  assert.equal(h.stored(), null);
});

test('concurrent expired requests rotate once and preserve upload body/headers', async () => {
  let refreshes = 0;
  const bodies = [];
  const next = { access: 'new-access', refresh: 'new-refresh' };
  const body = new FormData();
  body.append('audio', 'test-recording');
  const h = harness(async (url, init) => {
    if (url.endsWith('/config')) return json({ demo_mode: false });
    if (url.endsWith('/refresh')) {
      refreshes++;
      assert.equal(JSON.parse(init.body).refresh, pair.refresh);
      await new Promise((resolve) => setTimeout(resolve, 5));
      return json(next);
    }
    bodies.push(init.body);
    assert.equal(init.headers.has('Content-Type'), false);
    return json({}, init.headers.get('Authorization') === 'Bearer new-access' ? 200 : 401);
  }, JSON.stringify(pair));
  await h.session.initializeSession();
  const results = await Promise.all([1, 2].map(() => h.session.authenticatedFetch('https://api.test/notes', { method: 'POST', body })));
  assert.deepEqual(results.map((r) => r.status), [200, 200]);
  assert.equal(refreshes, 1);
  assert.ok(bodies.every((value) => value === body));
  assert.deepEqual(JSON.parse(h.stored()), next);
});

test('invalid refresh clears session and does not loop requests', async () => {
  let attempts = 0;
  const h = harness(async (url) => {
    if (url.endsWith('/config')) return json({ demo_mode: false });
    attempts++;
    return json({ detail: 'Session expired' }, 401);
  }, JSON.stringify(pair));
  await h.session.initializeSession();
  await assert.rejects(h.session.authenticatedFetch('https://api.test/map'), /Session expired/);
  assert.equal(attempts, 2);
  assert.equal(h.session.useSession().signedIn, false);
  assert.equal(h.stored(), null);
});

test('temporary refresh failure retains credentials for retry', async () => {
  const h = harness(async (url) => {
    if (url.endsWith('/config')) return json({ demo_mode: false });
    return url.endsWith('/refresh') ? json({ detail: 'Unavailable' }, 503) : json({}, 401);
  }, JSON.stringify(pair));
  await h.session.initializeSession();
  await assert.rejects(h.session.authenticatedFetch('https://api.test/map'), /Unavailable/);
  assert.equal(h.session.useSession().signedIn, true);
  assert.deepEqual(JSON.parse(h.stored()), pair);
});

test('verify stores credentials and logout revokes then removes them', async () => {
  const calls = [];
  const h = harness(async (url, init) => {
    if (url.endsWith('/config')) return json({ demo_mode: false });
    calls.push([url, JSON.parse(init.body)]);
    if (url.endsWith('/verify')) return json(pair);
    return new Response(null, { status: 204 });
  });
  await h.session.initializeSession();
  await h.session.sendCode('goldy@umn.edu');
  await h.session.verifyCode('goldy@umn.edu', '123456', true);
  assert.equal(h.session.useSession().signedIn, true);
  await h.session.signOut();
  assert.equal(calls[1][1].over18, true);
  assert.deepEqual(calls[2][1], { refresh: pair.refresh });
  assert.equal(h.stored(), null);
  assert.equal(h.session.useSession().signedIn, false);
});
