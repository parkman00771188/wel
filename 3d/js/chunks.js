/**
 * Archives that are too big to be one asset.
 *
 * Cloudflare Pages refuses any single file over 25 MiB, and two of the
 * catalogues are over it — quakes.bin at 34 MiB and the global M3 band at 28.
 * scripts/split_bins.py cuts those into `.partN` files and records the mapping
 * in `<base>parts.json`; this module hands every reader back one ArrayBuffer
 * so nothing downstream has to know which files were split.
 *
 * A logical name that is not in the manifest is fetched as-is, so this is also
 * correct on a host with no such limit and before the split has ever run.
 */

let manifest = null;

/** `{ "global/quakes-m3.bin": { bytes, parts: [...] }, … }`, fetched once. */
function partsManifest(base) {
  manifest ??= fetch(`${base}parts.json`, { cache: 'no-cache' })
    .then((res) => (res.ok ? res.json() : null))
    .then((payload) => (payload && payload.files) || {})
    .catch(() => ({}));   // no manifest is the normal unsplit case, not an error
  return manifest;
}

async function streamInto(url, chunks, onBytes) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);

  if (!res.body) {
    const buffer = await res.arrayBuffer();
    chunks.push(new Uint8Array(buffer));
    onBytes?.(buffer.byteLength);
    return;
  }
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    onBytes?.(value.length);
  }
}

/**
 * Fetch one logical binary, following the manifest when it was split.
 * `name` and the part paths are both relative to `base`.
 * `onBytes` receives the size of each chunk as it lands, so a caller can keep
 * a single progress bar across however many files it actually took.
 */
export async function fetchParts(base, name, onBytes) {
  const files = await partsManifest(base);
  const entry = files[name];
  const urls = entry?.parts?.length ? entry.parts : [name];

  const chunks = [];
  for (const url of urls) {
    await streamInto(base + url, chunks, onBytes);
  }

  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; }
  return out.buffer;
}
