import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { acknowledgeOutboxOperation, applyPending, identityRecords, migrateLibrary, persistOutboxOperation, readOutbox, wordKey } from "../src/lib/migrateLibrary.js";
import { wordPath } from "../src/lib/platform.js";

let values;
beforeEach(() => {
    values = new Map();
    globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key), key: index => [...values.keys()][index] ?? null, get length() { return values.size; } };
});

test("browser import copies identities and original dates, excluding proprietary snapshots", () => {
    assert.deepEqual(identityRecords([{ word: "lead", savedAt: 1720000000000, definition: "Restricted", audio: "restricted", notes: "unknown schema" }, null, { word: "" }], "savedAt"), [{ word: "lead", savedAt: 1720000000000 }]);
});

test("missing legacy dates use a stable import identity on every retry", () => {
    assert.deepEqual(identityRecords([{ word: "old" }], "savedAt"), [{ word: "old", savedAt: 0 }]);
});

test("case distinctions survive word URLs and local save identity", () => {
    assert.equal(wordPath("US"), "/word/US");
    assert.equal(wordPath("us"), "/word/us");
    assert.notEqual(wordKey("US"), wordKey("us"));
    assert.equal(wordKey("it's"), wordKey("it’s"));
});

test("verified migration is idempotent and never deletes or alters original keys", async () => {
    const old = JSON.stringify([{ word: "lead", savedAt: 1700000000000, definition: "Existing snapshot" }]);
    values.set("wa:saved", old);
    values.set("wa:history", JSON.stringify([{ word: "unknown", visitedAt: 1700000000001 }]));
    const requests = [];
    const request = async (path, options) => { requests.push({ path, ...options }); return { verified: true }; };
    await migrateLibrary("owner", request);
    await migrateLibrary("owner", request);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].body.saved[0].definition, undefined);
    assert.equal(values.get("wa:saved"), old);
    assert.equal(requests[0].body.history[0].visitedAt, 1700000000001);
});

test("partial failure retries only unverified batches with the same idempotency key", async () => {
    values.set("wa:saved", JSON.stringify(Array.from({ length: 600 }, (_, index) => ({ word: `word${index}`, savedAt: 1700000000000 + index }))));
    const requests = [];
    let fail = true;
    const request = async (path, options) => {
        requests.push({ path, ...options });
        if (options.body.saved[0].word === "word500" && fail) throw new Error("offline");
        return { verified: true };
    };
    await assert.rejects(migrateLibrary("owner", request), /offline/);
    fail = false;
    await migrateLibrary("owner", request);
    assert.equal(requests.length, 3);
    assert.equal(requests[1].operationId, requests[2].operationId);
    assert.equal(JSON.parse(values.get("wa:saved")).length, 600);
});

test("unverified import leaves originals and no completion marker", async () => {
    values.set("wa:saved", JSON.stringify([{ word: "lead", savedAt: 1700000000000 }]));
    await assert.rejects(migrateLibrary("owner", async () => ({ verified: false })), /verification/);
    assert.equal([...values.keys()].filter(key => key.startsWith("wa:imported")).length, 0);
});

test("ordered pending saves, removals and history clear preserve intent", () => {
    const ops = [{ kind: "remove", word: "US" }, { kind: "save", word: "atlas", at: 1 }, { kind: "clearHistory" }, { kind: "history", word: "unknown", at: 2 }];
    assert.deepEqual(applyPending([{ word: "US" }, { word: "us" }], ops, "saved").map(item => item.word), ["atlas", "us"]);
    assert.deepEqual(applyPending([{ word: "old", visitedAt: 0 }], ops, "history"), [{ word: "unknown", visitedAt: 2, pending: true }]);
});

test("source entries without glosses remain displayable instead of becoming false misses", async () => {
    const { splitEntries } = await import("../src/features/word/utils/entries.js");
    const entry = { id: "empty", word: "placeholder", source: { name: "English Wiktionary" }, senses: [{ senses: [] }] };
    assert.deepEqual(splitEntries([entry], "placeholder").primary, [entry]);
});

test("explicit form alternatives and case-exact entries remain distinct", async () => {
    const { splitEntries } = await import("../src/features/word/utils/entries.js");
    const senses = [{ senses: [{ definition: "Synthetic meaning." }] }];
    const lower = { word: "us", senses }, upper = { word: "US", senses };
    assert.deepEqual(splitEntries([lower, upper], "US").primary, [upper]);
    const forms = [{ word: "run", partOfSpeech: "verb", senses, requestedForm: { form: "running" } },
        { word: "running", partOfSpeech: "noun", senses, requestedForm: { form: "runnings" } }];
    assert.equal(splitEntries(forms, "runnings").primary.length, 2);
});

test("unavailable browser storage is observable instead of claiming a durable write", async () => {
    const { writeStorage } = await import("../src/lib/storage.js");
    globalThis.localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
    assert.equal(writeStorage("wa:outbox:v1", []), false);
});

test("independent offline operations survive stale tabs and individual acknowledgments", () => {
    const firstTab = readOutbox();
    const secondTab = readOutbox();
    assert.equal(firstTab.length + secondTab.length, 0);
    persistOutboxOperation({ id: "cat-operation", kind: "save", word: "cat", at: 1, queuedAt: 1 });
    persistOutboxOperation({ id: "dog-operation", kind: "save", word: "dog", at: 2, queuedAt: 2 });
    assert.deepEqual(readOutbox().map(item => item.word), ["cat", "dog"]);
    assert.equal(acknowledgeOutboxOperation("cat-operation"), true);
    assert.deepEqual(readOutbox().map(item => item.word), ["dog"]);
    assert.equal(acknowledgeOutboxOperation("dog-operation"), true);
    assert.deepEqual(readOutbox(), []);
    assert.equal(values.size, 0, "new acknowledgments do not accumulate permanent tombstones");
});

test("legacy outbox migrates by identity, preserves same-time order and originals, and never resurrects acknowledged changes", () => {
    const original = JSON.stringify([{ id: "z-save", kind: "save", word: "cat", at: 1 }, { id: "a-remove", kind: "remove", word: "cat", at: 1 }]);
    values.set("wa:outbox:v1", original);
    assert.deepEqual(readOutbox().map(item => item.kind), ["save", "remove"]);
    persistOutboxOperation({ ...readOutbox()[0], ownerId: "owner" });
    assert.equal(readOutbox().length, 2);
    assert.equal(readOutbox()[0].ownerId, "owner");
    acknowledgeOutboxOperation("z-save");
    acknowledgeOutboxOperation("a-remove");
    assert.deepEqual(readOutbox(), []);
    assert.equal(values.get("wa:outbox:v1"), original);
    persistOutboxOperation({ id: "new-save", kind: "save", word: "dog", at: 2, queuedAt: 2 });
    assert.deepEqual(readOutbox().map(item => item.word), ["dog"]);
});

test("failed acknowledgment retains the durable operation for idempotent retry", () => {
    persistOutboxOperation({ id: "pending", kind: "save", word: "cat", at: 1 });
    globalThis.localStorage.removeItem = () => { throw new Error("storage blocked"); };
    assert.equal(acknowledgeOutboxOperation("pending"), false);
    assert.equal(readOutbox()[0].id, "pending");
});
