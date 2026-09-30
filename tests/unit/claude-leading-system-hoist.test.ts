import test from "node:test";
import assert from "node:assert/strict";
import {
  hoistLeadingSystemMessages,
  relocateDirectiveOnlyMessages,
} from "../../open-sse/handlers/chatCore.ts";

// Production: a Claude Code session emitted a text system-role message
// (`<total_tokens>…</total_tokens>`) at messages[0]. Anthropic answers
//   messages.0: use the top-level 'system' parameter for the initial system prompt
// and relocateDirectiveOnlyMessages() only handled the empty directive form, so every
// turn 400'd on the direct claude connection and fell back to another provider.

test("hoistLeadingSystemMessages lifts a text system message at messages[0] into top-level system", () => {
  const payload: Record<string, unknown> = {
    system: [{ type: "text", text: "You are Claude Code." }],
    messages: [
      { role: "system", content: "<total_tokens>1000 tokens left</total_tokens>" },
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ],
  };
  hoistLeadingSystemMessages(payload);
  const messages = payload.messages as Array<{ role: string }>;
  assert.equal(messages.length, 2);
  assert.equal(messages[0].role, "user");
  assert.deepEqual(payload.system, [
    { type: "text", text: "You are Claude Code." },
    { type: "text", text: "<total_tokens>1000 tokens left</total_tokens>" },
  ]);
});

test("hoistLeadingSystemMessages hoists the whole leading run and keeps later mid-conversation system messages", () => {
  const payload: Record<string, unknown> = {
    system: "base",
    messages: [
      { role: "system", content: "first" },
      { role: "developer", content: [{ type: "text", text: "second" }] },
      { role: "user", content: "hello" },
      { role: "system", content: "mid" },
      { role: "assistant", content: "hi" },
    ],
  };
  hoistLeadingSystemMessages(payload);
  const messages = payload.messages as Array<{ role: string; content: unknown }>;
  assert.deepEqual(
    messages.map((m) => m.role),
    ["user", "system", "assistant"]
  );
  assert.deepEqual(payload.system, [
    { type: "text", text: "base" },
    { type: "text", text: "first" },
    { type: "text", text: "second" },
  ]);
});

test("hoistLeadingSystemMessages is a no-op when messages[0] is not a system message", () => {
  const payload: Record<string, unknown> = {
    system: "base",
    messages: [
      { role: "user", content: "hello" },
      { role: "system", content: "mid" },
    ],
  };
  const before = JSON.stringify(payload);
  hoistLeadingSystemMessages(payload);
  assert.equal(JSON.stringify(payload), before);
});

test("directive first then text system: after relocation + hoist no system message is left at messages[0]", () => {
  const payload: Record<string, unknown> = {
    system: "base",
    messages: [
      { role: "system", content: [], output_config: { effort: "high" } },
      { role: "system", content: "context note" },
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ],
  };
  relocateDirectiveOnlyMessages(payload);
  hoistLeadingSystemMessages(payload);
  const messages = payload.messages as Array<{ role: string }>;
  assert.notEqual(messages[0].role, "system");
  assert.equal(messages[0].role, "user");
});

test("hoistLeadingSystemMessages does not throw on empty or missing messages", () => {
  hoistLeadingSystemMessages({});
  hoistLeadingSystemMessages({ messages: [] });
  hoistLeadingSystemMessages({ messages: "nope" });
});
