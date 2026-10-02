import test from "node:test";
import assert from "node:assert/strict";

import { resolveMemoryOwnerId } from "../../open-sse/handlers/chatCore/memoryExtraction.ts";

test("resolveMemoryOwnerId returns the id when present, null otherwise", () => {
  assert.equal(resolveMemoryOwnerId({ id: "key_123" }), "key_123");
  // whitespace-only id is rejected
  assert.equal(resolveMemoryOwnerId({ id: "   " }), null);
  // non-string id is rejected
  assert.equal(resolveMemoryOwnerId({ id: 7 } as unknown as Record<string, unknown>), null);
  // missing id / null info
  assert.equal(resolveMemoryOwnerId({}), null);
  assert.equal(resolveMemoryOwnerId(null), null);
});
