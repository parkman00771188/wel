"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const source = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("external referrals stay on the requested standalone page", () => {
  for (const pathname of ["/map", "/learn", "/guide/earthquake-basics"]) {
    for (const referrer of ["", "https://www.google.com/", "https://example.org/article"]) {
      const redirects = [];
      const handlers = {};
      const context = {
        document: {
          referrer,
          body: { dataset: {} },
          addEventListener(name, fn) { handlers[name] = fn; },
          getElementById() { return null; },
          querySelectorAll() { return []; }
        },
        location: {
          pathname, search: "?lang=en", hash: "", host: "worldearthquakelabs.com",
          href: "https://worldearthquakelabs.com" + pathname,
          replace(target) { redirects.push(target); }
        },
        localStorage: { getItem() { return null; } },
        addEventListener() {},
        URL, URLSearchParams, console
      };
      context.window = context;
      context.parent = context;
      context.top = context;
      context.self = context;
      vm.runInNewContext(source("js/common.js"), context);
      handlers.DOMContentLoaded();
      assert.deepEqual(redirects, [], pathname + " referred by " + referrer);
    }
  }
});

function bandBuffer(rows, epoch) {
  const buf = new ArrayBuffer(8 + rows.length * 20);
  new Uint32Array(buf, 0, 2).set([0x00315147, rows.length]);
  for (let field = 0; field < 4; field++) {
    new Float32Array(buf, 8 + field * rows.length * 4, rows.length)
      .set(rows.map((row) => [row.longitude, row.latitude, row.depth_km, row.magnitude][field]));
  }
  new Uint32Array(buf, 8 + rows.length * 16, rows.length)
    .set(rows.map((row) => (row.time_ms - epoch) / 1000));
  return buf;
}

test("review status follows source metadata through filtering and live overlay merging", async () => {
  const now = Date.now();
  const day = 86400e3;
  const epoch = Date.parse("1900-01-01T00:00:00Z");
  const row = (daysAgo, magnitude, status) => ({
    time_ms: now - daysAgo * day, longitude: 140, latitude: 35,
    depth_km: 15, magnitude, status
  });
  const archive = [row(20, 6, undefined)];
  const live = {
    generated_utc: new Date(now).toISOString(),
    window_start_utc: new Date(now - 14 * day).toISOString(),
    events: [row(12, 4.1, undefined), row(8, 2, "reviewed"), row(7, 4.2, "automatic"), row(0.1, 4.3, "reviewed")]
  };
  const context = {
    console,
    setInterval() {},
    async fetch(url) {
      let payload;
      if (url.endsWith("meta.json")) payload = { epoch: new Date(epoch).toISOString(), generated_utc: "2026-09-01T00:00:00Z", count: 1 };
      else if (url.endsWith("parts.json")) payload = { files: {} };
      else if (url.endsWith("countries-110m.geojson")) payload = { features: [] };
      else if (url.endsWith("live/global.json")) payload = live;
      else if (url.endsWith("quakes-m5.bin")) return { ok: true, arrayBuffer: async () => bandBuffer(archive, epoch) };
      else if (url.endsWith("quakes-m4.bin")) return { ok: true, arrayBuffer: async () => bandBuffer([], epoch) };
      else throw new Error("Unexpected resource: " + url);
      return { ok: true, json: async () => payload };
    }
  };
  context.window = context;
  vm.runInNewContext(source("js/data.js"), context);
  await context.EQ.ready;
  assert.equal(context.EQ.loaded, true);
  const events = context.EQ.events;
  assert.equal(events.length, 4);
  assert.equal(events.find((e) => e.m === 4.3).status, "Reviewed", "a new reviewed event stays reviewed");
  assert.equal(events.find((e) => e.m === 4.2).status, "Automatic", "age does not turn automatic into reviewed");
  assert.equal(events.find((e) => e.m === 4.1).status, "Not provided", "missing live metadata remains unknown");
  assert.equal(events.find((e) => e.m === 6).status, "Not provided", "archive age implies no review status");
  assert.equal(context.EQ.reviewStatus("unsupported"), "Not provided");
});
