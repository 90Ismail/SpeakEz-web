const test = require("node:test");
const assert = require("node:assert");
const shim = require("../public/web-shim.js");

test("encodeWav writes a valid 16-bit mono PCM header", () => {
  const wav = new DataView(shim.encodeWav(new Float32Array([0, 1, -1, 0.5]), 16000));
  const tag = (o) => String.fromCharCode(wav.getUint8(o), wav.getUint8(o + 1), wav.getUint8(o + 2), wav.getUint8(o + 3));
  assert.equal(tag(0), "RIFF"); assert.equal(tag(8), "WAVE"); assert.equal(tag(12), "fmt "); assert.equal(tag(36), "data");
  assert.equal(wav.getUint32(4, true), 36 + 8);
  assert.equal(wav.getUint16(22, true), 1);
  assert.equal(wav.getUint32(24, true), 16000);
  assert.equal(wav.getUint16(34, true), 16);
  assert.equal(wav.getUint32(40, true), 8);
  assert.equal(wav.getInt16(46, true), 32767);
  assert.equal(wav.getInt16(48, true), -32768);
});

test("encodeWav clips out-of-range samples", () => {
  const wav = new DataView(shim.encodeWav(new Float32Array([5, -5]), 8000));
  assert.equal(wav.getInt16(44, true), 32767);
  assert.equal(wav.getInt16(46, true), -32768);
});

test("mixToMono averages channels and handles empty input", () => {
  const mono = shim.mixToMono([new Float32Array([1, 0]), new Float32Array([0, 1])]);
  assert.deepStrictEqual(Array.from(mono), [0.5, 0.5]);
  assert.equal(shim.mixToMono([]).length, 0);
  const single = new Float32Array([0.1]);
  assert.equal(shim.mixToMono([single]), single);
});

test("resample changes length proportionally and keeps values in range", () => {
  const src = Float32Array.from({ length: 48000 }, (_, i) => Math.sin(i / 50));
  const out = shim.resample(src, 48000, 16000);
  assert.equal(out.length, 16000);
  assert.ok(out.every((x) => x >= -1 && x <= 1));
  assert.equal(shim.resample(src, 48000, 48000), src);
  assert.equal(shim.resample(new Float32Array(0), 48000, 16000).length, 0);
});

test("isRnFile detects the phone app's {uri} file objects only", () => {
  assert.ok(shim.isRnFile({ uri: "blob:x", name: "a.m4a", type: "audio/mp4" }));
  assert.ok(!shim.isRnFile("text"));
  assert.ok(!shim.isRnFile(null));
  assert.ok(!shim.isRnFile(new Blob(["x"])));
});

test("toUploadBlob keeps natively supported formats", async () => {
  const wav = await shim.toUploadBlob(new Blob(["x"], { type: "audio/wav" }), {});
  assert.equal(wav.name, "recording.wav");
  const mp4 = await shim.toUploadBlob(new Blob(["x"], { type: "audio/mp4;codecs=mp4a.40.2" }), {});
  assert.equal(mp4.name, "recording.m4a");
});

test("toUploadBlob converts webm to 16 kHz mono wav", async () => {
  class FakeCtx {
    decodeAudioData(_ab, ok) { const r = { numberOfChannels: 2, sampleRate: 48000, getChannelData: () => new Float32Array(48000).fill(0.25) }; ok(r); }
    close() {}
  }
  const out = await shim.toUploadBlob(new Blob(["webm"], { type: "audio/webm;codecs=opus" }), { AudioContext: FakeCtx });
  assert.equal(out.name, "recording.wav");
  assert.equal(out.blob.type, "audio/wav");
  assert.equal(out.blob.size, 44 + 16000 * 2);
});

test("toUploadBlob falls back to the original blob when decoding fails or is unavailable", async () => {
  class BadCtx { decodeAudioData(_ab, _ok, fail) { fail(new Error("bad")); } close() {} }
  const blob = new Blob(["webm"], { type: "audio/webm" });
  assert.equal((await shim.toUploadBlob(blob, { AudioContext: BadCtx })).blob, blob);
  assert.equal((await shim.toUploadBlob(blob, {})).name, "recording.webm");
});

test("install: an RN-style audio field becomes a real file part on upload", async () => {
  class FD extends FormData {}
  const sent = [];
  const win = {
    FormData: FD, location: { origin: "https://x.app" },
    fetch: async (url, init) => {
      if (String(url) === "blob:rec") return new Response(new Blob(["RIFFdata"], { type: "audio/wav" }));
      if (String(url) === "/voices/manifest.json") return new Response("[]");
      sent.push({ url: String(url), body: init && init.body });
      return new Response(JSON.stringify({ id: "n1" }), { status: 200 });
    },
  };
  shim.install(win);
  const form = new FD();
  form.append("audio", { uri: "blob:rec", name: "recording.m4a", type: "audio/mp4" });
  form.append("duration_sec", "12");
  const res = await win.fetch("https://api.x.io/notes", { method: "POST", body: form });
  assert.equal(res.status, 200);
  const part = sent[0].body.get("audio");
  assert.ok(part instanceof Blob, "audio is a real Blob, not [object Object]");
  assert.equal(part.name, "recording.wav");
  assert.equal(await part.text(), "RIFFdata");
  assert.equal(sent[0].body.get("duration_sec"), "12");
});

test("install: plain form fields and non-RN values are left alone", async () => {
  class FD extends FormData {}
  const win = { FormData: FD, location: { origin: "https://x.app" }, fetch: async () => new Response("{}") };
  shim.install(win);
  const f = new FD();
  f.append("a", "1"); f.append("file", new Blob(["z"]), "z.txt");
  assert.equal(f.get("a"), "1");
  assert.equal(f.get("file").name, "z.txt");
});
