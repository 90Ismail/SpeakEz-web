/* speakEz web: guarantees every seeded voice note has audio.
 * If the API returns a note (or reply) without audio_url, fill it from /voices/manifest.json
 * by matching the transcript. Real API audio is never overridden. Web build only. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else api.install(root);
})(typeof self !== "undefined" ? self : this, function () {
  function normalize(text) {
    return String(text == null ? "" : text).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);
  }
  function findVoice(manifest, kind, text) {
    var key = normalize(text);
    if (!key || !Array.isArray(manifest)) return null;
    for (var i = 0; i < manifest.length; i++) {
      if ((kind === "reply") === (manifest[i].kind === "reply") && manifest[i].key === key) return manifest[i];
    }
    return null;
  }
  function absolute(origin, src) { return String(origin || "").replace(/\/$/, "") + src; }
  function patchUnlock(data, manifest, origin) {
    if (!data || typeof data !== "object") return data;
    var out = Object.assign({}, data);
    if (!out.audio_url) {
      var v = findVoice(manifest, "note", String(out.body || "").split(/\n{2,}/)[0]);
      if (v) {
        out.audio_url = absolute(origin, v.src);
        if (!out.words || !out.words.length) out.words = v.words || out.words || null;
      }
    }
    if (Array.isArray(out.replies)) {
      out.replies = out.replies.map(function (r) {
        if (!r || r.audio_url) return r;
        var v = findVoice(manifest, "reply", r.body);
        return v ? Object.assign({}, r, { audio_url: absolute(origin, v.src), duration_sec: Math.ceil(v.duration) }) : r;
      });
    }
    return out;
  }
  function patchMap(data, manifest) {
    if (!data || !Array.isArray(data.notes)) return data;
    var titles = {};
    (manifest || []).forEach(function (m) { if (m.title && m.kind === "note") titles[normalize(m.title)] = m; });
    return Object.assign({}, data, {
      notes: data.notes.map(function (n) {
        var v = n && n.title ? titles[normalize(n.title)] : null;
        return v ? Object.assign({}, n, { duration_sec: Math.ceil(v.duration) }) : n;
      }),
    });
  }
  /* ---- recording upload: the phone app appends {uri,name,type} to FormData, which browsers stringify ---- */
  function isRnFile(v) {
    return !!v && typeof v === "object" && typeof v.uri === "string" && !(typeof Blob !== "undefined" && v instanceof Blob);
  }
  function mixToMono(channels) {
    if (!channels.length) return new Float32Array(0);
    if (channels.length === 1) return channels[0];
    var n = channels[0].length, out = new Float32Array(n);
    for (var c = 0; c < channels.length; c++) for (var i = 0; i < n; i++) out[i] += channels[c][i] / channels.length;
    return out;
  }
  function resample(samples, from, to) {
    if (!samples.length || from === to) return samples;
    var n = Math.max(1, Math.round(samples.length * to / from)), out = new Float32Array(n), ratio = from / to;
    for (var i = 0; i < n; i++) {
      var pos = i * ratio, i0 = Math.floor(pos), i1 = Math.min(i0 + 1, samples.length - 1), f = pos - i0;
      out[i] = samples[i0] * (1 - f) + samples[i1] * f;
    }
    return out;
  }
  function encodeWav(samples, sampleRate) {
    var n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, "data"); v.setUint32(40, n * 2, true);
    for (var i = 0; i < n; i++) {
      var s = Math.max(-1, Math.min(1, samples[i]));
      v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buf;
  }
  var NATIVE = { "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav", "audio/mp4": "m4a", "audio/m4a": "m4a", "audio/x-m4a": "m4a", "audio/aac": "m4a", "audio/mpeg": "mp3" };
  function baseType(t) { return String(t || "").split(";")[0].trim().toLowerCase(); }
  /* Browsers record webm/ogg; the API reads wav, m4a and mp3. Keep native formats, turn the rest into 16 kHz mono WAV. */
  function toUploadBlob(blob, win) {
    var ext = NATIVE[baseType(blob.type)];
    if (ext) return Promise.resolve({ blob: blob, name: "recording." + ext });
    var Ctx = win && (win.AudioContext || win.webkitAudioContext);
    if (!Ctx) return Promise.resolve({ blob: blob, name: "recording.webm" });
    var ctx = new Ctx();
    return blob.arrayBuffer().then(function (ab) {
      return new Promise(function (ok, fail) { var r = ctx.decodeAudioData(ab, ok, fail); if (r && r.then) r.then(ok, fail); });
    }).then(function (decoded) {
      var chans = [];
      for (var c = 0; c < decoded.numberOfChannels; c++) chans.push(decoded.getChannelData(c));
      var wav = encodeWav(resample(mixToMono(chans), decoded.sampleRate, 16000), 16000);
      return { blob: new Blob([wav], { type: "audio/wav" }), name: "recording.wav" };
    }).catch(function () {
      return { blob: blob, name: "recording.webm" };
    }).then(function (r) { try { ctx.close && ctx.close(); } catch (e) {} return r; });
  }
  function resolveRnFiles(form, fetchImpl, appendImpl, win) {
    var pending = form.__rn || [];
    if (!pending.length) return Promise.resolve(form);
    form.__rn = [];
    return Promise.all(pending.map(function (p) {
      return fetchImpl(p.file.uri).then(function (r) { return r.blob(); }).then(function (b) { return toUploadBlob(b, win); })
        .then(function (u) { appendImpl.call(form, p.name, u.blob, u.name); });
    })).then(function () { return form; });
  }
  function isMapUrl(url) { return /\/map(?:[?#]|$)/.test(String(url)); }
  function isUnlockUrl(url) { return /\/notes\/[^/?#]+\/unlock(?:[?#]|$)/.test(String(url)); }
  function install(win) {
    if (!win || typeof win.fetch !== "function" || win.__speakezVoices) return;
    win.__speakezVoices = true;
    var orig = win.fetch.bind(win), manifestPromise = null;
    var FD = win.FormData, origAppend = FD && FD.prototype && FD.prototype.append;
    if (origAppend) {
      FD.prototype.append = function (name, value) {
        if (isRnFile(value)) { (this.__rn = this.__rn || []).push({ name: name, file: value }); return; }
        return origAppend.apply(this, arguments);
      };
    }
    function manifest() {
      if (!manifestPromise) {
        manifestPromise = orig("/voices/manifest.json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
      }
      return manifestPromise;
    }
    win.fetch = function (input, init) {
      var url = typeof input === "string" ? input : input && input.url;
      if (origAppend && init && FD && init.body instanceof FD && init.body.__rn && init.body.__rn.length) {
        return resolveRnFiles(init.body, orig, origAppend, win).then(function () { return win.fetch(input, init); });
      }
      var p = orig(input, init);
      var unlock = isUnlockUrl(url);
      if (!unlock && !isMapUrl(url)) return p;
      return p.then(function (res) {
        if (!res || !res.ok) return res;
        return Promise.all([res.clone().json(), manifest()]).then(function (a) {
          var body = JSON.stringify((unlock ? patchUnlock(a[0], a[1], win.location && win.location.origin) : patchMap(a[0], a[1])));
          var headers = new Headers(res.headers); headers.delete("content-length"); headers.set("content-type", "application/json");
          return new Response(body, { status: res.status, statusText: res.statusText, headers: headers });
        }).catch(function () { return res; });
      });
    };
  }
  return { normalize: normalize, findVoice: findVoice, patchUnlock: patchUnlock, patchMap: patchMap, isMapUrl: isMapUrl, isRnFile: isRnFile, mixToMono: mixToMono, resample: resample, encodeWav: encodeWav, toUploadBlob: toUploadBlob, isUnlockUrl: isUnlockUrl, install: install };
});
