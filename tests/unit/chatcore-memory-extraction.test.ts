import test from "node:test";
import assert from "node:assert/strict";

import {
  extractMemoryTextFromRequestBody,
  resolveMemoryOwnerId,
} from "../../open-sse/handlers/chatCore/memoryExtraction.ts";

test("extractMemoryTextFromRequestBody returns the LAST user message (string content)", () => {
  const body = {
    messages: [
      { role: "user", content: "first" },
      { role: "assistant", content: "ignored" },
      { role: "user", content: "second" },
    ],
  };
  assert.equal(extractMemoryTextFromRequestBody(body), "second");
});

test("extractMemoryTextFromRequestBody joins array content parts of the last user message", () => {
  const body = {
    messages: [
      {
        role: "user",
        content: [
          { type: "input_text", text: " a " },
          { text: "b" },
          { type: "image_url" },
        ],
      },
    ],
  };
  assert.equal(extractMemoryTextFromRequestBody(body), "a\nb");
});

test("extractMemoryTextFromRequestBody reads Responses-style input items", () => {
  const inputBody = {
    input: [{ role: "user", type: "message", content: [{ type: "input_text", text: "hey" }] }],
  };
  assert.equal(extractMemoryTextFromRequestBody(inputBody), "hey");
});

test("extractMemoryTextFromRequestBody reads a bare string Responses input", () => {
  assert.equal(extractMemoryTextFromRequestBody({ input: "  I prefer tea.  " }), "I prefer tea.");
});

test("extractMemoryTextFromRequestBody reads a string-content input item", () => {
  const inputBody = {
    input: [{ role: "user", type: "message", content: "  plain  " }],
  };
  assert.equal(extractMemoryTextFromRequestBody(inputBody), "plain");
});

test("extractMemoryTextFromRequestBody scans input items from the end and returns the last user text", () => {
  // The primary input scan walks from the end and returns immediately on the
  // last item whose role is user (or unset) and type is message (or unset).
  const inputBody = {
    input: [
      { type: "reasoning", content: "thinking" }, // itemType !== "message" -> skipped
      { role: "user", content: "alpha" }, // matches, but an earlier item from the end wins
      { role: "user", content: "beta" }, // last matching item -> returned
    ],
  };
  assert.equal(extractMemoryTextFromRequestBody(inputBody), "beta");
});

test("extractMemoryTextFromRequestBody skips assistant input items but accepts the prior user item", () => {
  const inputBody = {
    input: [
      { role: "user", type: "message", content: "the question" },
      { role: "assistant", type: "message", content: "the answer" }, // role !== user -> skipped
    ],
  };
  assert.equal(extractMemoryTextFromRequestBody(inputBody), "the question");
});

test("extractMemoryTextFromRequestBody returns empty for null/empty/no-user bodies", () => {
  assert.equal(extractMemoryTextFromRequestBody(null), "");
  assert.equal(extractMemoryTextFromRequestBody(undefined), "");
  assert.equal(extractMemoryTextFromRequestBody({}), "");
  // only an assistant message -> no user text
  assert.equal(
    extractMemoryTextFromRequestBody({ messages: [{ role: "assistant", content: "x" }] }),
    ""
  );
});

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
