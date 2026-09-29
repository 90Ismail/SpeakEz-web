const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const shim = require("../public/web-shim.js");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "../public/voices/manifest.json"), "utf8"));
const origin = "https://speakez-wakehaven.vercel.app";
const WALTER = "I didn't really know where else to say this, so I'm saying it here — on the steps outside Walter, where I've basically lived for the last three weeks.\n\nEveryone keeps telling me I'm doing great.";

test("normalize strips punctuation, case and truncates", () => {
  assert.equal(shim.normalize("  Hello,  WORLD! "), "hello world");
  assert.equal(shim.normalize(null), "");
  assert.equal(shim.normalize("a".repeat(200)).length, 80);
});

test("fills audio and word timings for the Walter note", () => {
  const out = shim.patchUnlock({ body: WALTER, words: null, audio_url: null, replies: [] }, manifest, origin);
  assert.equal(out.audio_url, origin + "/voices/tired-at-walter.mp3");
  assert.ok(out.words.length > 100 && out.words[0].word === "I");
});

test("never overrides real API audio or words", () => {
  const real = { body: WALTER, words: [{ word: "x", start: 0, end: 1 }], audio_url: "/media/a.mp3?sig=1", replies: [] };
  const out = shim.patchUnlock(real, manifest, origin);
  assert.equal(out.audio_url, "/media/a.mp3?sig=1");
  assert.equal(out.words.length, 1);
});

test("leaves words alone when the API already supplied audio", () => {
  const out = shim.patchUnlock({ body: WALTER, words: null, audio_url: "/media/a.mp3" }, manifest, origin);
  assert.equal(out.words, null);
});

test("unknown notes are untouched", () => {
  const data = { body: "A brand new note nobody seeded.", audio_url: null, words: null, replies: [] };
  assert.deepStrictEqual(shim.patchUnlock(data, manifest, origin), data);
});

test("replies get audio by transcript and notes are not confused with replies", () => {
  const out = shim.patchUnlock({
    body: WALTER, audio_url: null, words: null,
    replies: [{ id: "r1", body: "Same floor, same flickering lights. I'm usually by the east windows. You're not the only one still here.", audio_url: null },
              { id: "r2", body: "some new reply", audio_url: null }],
  }, manifest, origin);
  assert.equal(out.replies[0].audio_url, origin + "/voices/reply-walter-1.mp3");
  assert.equal(out.replies[1].audio_url, null);
  assert.equal(shim.findVoice(manifest, "reply", WALTER.split("\n\n")[0]), null);
});

test("journal entry maps to its audio", () => {
  const out = shim.patchUnlock({ body: "I just needed to say this out loud once.", audio_url: null }, manifest, origin);
  assert.equal(out.audio_url, origin + "/voices/journal-not-ready.mp3");
});

test("only unlock URLs are intercepted", () => {
  assert.ok(shim.isUnlockUrl("https://api.x.io/notes/abc-123/unlock"));
  assert.ok(!shim.isUnlockUrl("https://api.x.io/notes/abc-123/reactions"));
  assert.ok(!shim.isUnlockUrl("https://api.x.io/map"));
});

test("map durations match the real audio length", () => {
  const data = { notes: [{ id: "1", title: "I don't think anyone knows how tired I am", duration_sec: 134 }, { id: "2", title: "Unseeded", duration_sec: 50 }] };
  const out = shim.patchMap(data, manifest);
  assert.equal(out.notes[0].duration_sec, 48);
  assert.equal(out.notes[1].duration_sec, 50);
  assert.deepStrictEqual(shim.patchMap({}, manifest), {});
  assert.ok(shim.isMapUrl("https://api.x.io/map?bbox=1,2,3,4") && !shim.isMapUrl("https://api.x.io/mapping"));
});

test("patchUnlock is safe on junk input", () => {
  assert.equal(shim.patchUnlock(null, manifest, origin), null);
  assert.deepStrictEqual(shim.patchUnlock({}, manifest, origin), {});
  assert.deepStrictEqual(shim.patchUnlock({ body: "x", replies: [null] }, [], origin), { body: "x", replies: [null] });
});

test("install wraps fetch, patches unlock responses and passes everything else through", async () => {
  const calls = [];
  const win = {
    location: { origin },
    fetch: async (url) => {
      calls.push(String(url));
      if (String(url) === "/voices/manifest.json") return new Response(JSON.stringify(manifest), { status: 200 });
      if (/unlock/.test(String(url))) return new Response(JSON.stringify({ body: WALTER, audio_url: null, words: null, replies: [] }), { status: 200, headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify({ ok: 1 }), { status: 200 });
    },
  };
  shim.install(win);
  const patched = await (await win.fetch("https://api.x.io/notes/n1/unlock", { method: "POST" })).json();
  assert.equal(patched.audio_url, origin + "/voices/tired-at-walter.mp3");
  const other = await (await win.fetch("https://api.x.io/map")).json();
  assert.deepStrictEqual(other, { ok: 1 });
  const errWin = { location: { origin }, fetch: async () => new Response("{}", { status: 403 }) };
  shim.install(errWin);
  assert.equal((await errWin.fetch("https://api.x.io/notes/n1/unlock")).status, 403);
});

test("every seeded note and reply in api/seed.py has a real audio file", () => {
  const seed = fs.readFileSync(path.join(__dirname, "../api/seed.py"), "utf8");
  const slugs = [...seed.matchAll(/"slug": "([a-z0-9-]+)"/g)].map((m) => m[1]);
  assert.ok(slugs.length >= 11);
  for (const slug of slugs) {
    const entry = manifest.find((m) => m.slug === slug);
    assert.ok(entry, "manifest entry for " + slug);
    const file = path.join(__dirname, "../public" + entry.src);
    assert.ok(fs.statSync(file).size > 10000, "audio file for " + slug);
    assert.ok(entry.duration > 2, "duration for " + slug);
  }
  assert.ok(manifest.some((m) => m.slug === "journal-not-ready"));
});
