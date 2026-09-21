import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeUpstreamHeadersMap } from "../../src/lib/db/models.ts";

test("sanitizeUpstreamHeadersMap: drops hop-by-hop / Host names", () => {
  const out = sanitizeUpstreamHeadersMap({
    Host: "evil",
    Connection: "close",
    "Content-Length": "999",
    "X-Custom": "ok",
  });
  assert.deepEqual(out, { "X-Custom": "ok" });
});

test("sanitizeUpstreamHeadersMap: drops values with CR/LF", () => {
  const out = sanitizeUpstreamHeadersMap({
    Good: "a",
    Bad: "x\ny",
    Bad2: "x\ry",
  });
  assert.deepEqual(out, { Good: "a" });
});

test("sanitizeUpstreamHeadersMap: drops names that fetch Headers rejects (e-mail from autofill)", () => {
  const raw = {
    "admin@example.com": "secret",
    "Bad Name": "x",
    "X-Ünï": "x",
    "X-Good_1.2": "ok",
  };
  const out = sanitizeUpstreamHeadersMap(raw);
  assert.deepEqual(out, { "X-Good_1.2": "ok" });
  // Negative control: the unsanitized map really does make Headers throw.
  assert.throws(() => new Headers(raw), TypeError);
  // Every name that survives sanitization must be accepted by Headers.
  assert.doesNotThrow(() => new Headers(out));
});

test("upstreamHeadersRecordSchema: rejects an e-mail style header name", async () => {
  const { upstreamHeadersRecordSchema } = await import("../../src/shared/validation/schemas/misc.ts");
  assert.equal(upstreamHeadersRecordSchema.safeParse({ "admin@example.com": "x" }).success, false);
  assert.equal(upstreamHeadersRecordSchema.safeParse({ "X-Title": "x" }).success, true);
});

test("sanitizeUpstreamHeadersMap: caps count at 16", () => {
  const raw = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`H${i}`, String(i)]));
  const out = sanitizeUpstreamHeadersMap(raw);
  assert.strictEqual(Object.keys(out).length, 16);
});
