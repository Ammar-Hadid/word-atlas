import { readStorage, removeStorage, storageKeys, writeStorage } from "./storage.js";
import { libraryRequest } from "./libraryApi.js";

export const wordKey = (word = "") => word.normalize("NFC").replace(/[‘’ʼ]/g, "'").replace(/[‐‑‒–—−]/g, "-").replace(/\s+/g, " ").trim();

const LEGACY_OUTBOX = "wa:outbox:v1";
const OPERATION_PREFIX = "wa:outbox:v2:operation:";
const COMPLETED_PREFIX = "wa:outbox:v2:legacy-completed:";
const validOperation = item => typeof item?.id === "string" && ["save", "remove", "history", "clearHistory"].includes(item.kind);
const legacyOperations = () => {
    const value = readStorage(LEGACY_OUTBOX, []);
    return Array.isArray(value) ? value.filter(validOperation) : [];
};

export const isOutboxStorageKey = key => key === null || key === LEGACY_OUTBOX || key.startsWith("wa:outbox:v2:");
export const compareOutboxOperations = (left, right) => (left.queuedAt ?? left.at ?? 0) - (right.queuedAt ?? right.at ?? 0)
    || (left.queuedAt === undefined && right.queuedAt === undefined ? 0 : left.id.localeCompare(right.id));

// Each operation has its own atomic storage write. An old tab never replaces
// another tab's queue. Read the old array in place so its recovery copy survives.
export function readOutbox() {
    const items = new Map(legacyOperations().map(item => [item.id, item]));
    for (const key of storageKeys()) {
        if (!key.startsWith(OPERATION_PREFIX)) continue;
        const item = readStorage(key, null);
        if (validOperation(item)) items.set(item.id, item);
    }
    return [...items.values()]
        .filter(item => !readStorage(`${COMPLETED_PREFIX}${item.id}`, false))
        .sort(compareOutboxOperations);
}

export const persistOutboxOperation = item => writeStorage(`${OPERATION_PREFIX}${item.id}`, item);

export function acknowledgeOutboxOperation(id) {
    // Only preserved legacy operations need tombstones. New operations are
    // removed individually after acknowledgment, keeping storage bounded.
    if (legacyOperations().some(item => item.id === id) && !writeStorage(`${COMPLETED_PREFIX}${id}`, true)) return false;
    return removeStorage(`${OPERATION_PREFIX}${id}`);
}

// Copy identities and user timestamps only. Legacy snapshots may contain
// proprietary definitions; they stay in the untouched original browser keys.
export function identityRecords(records, dateField) {
    if (!Array.isArray(records)) return [];
    return records.filter(item => typeof item?.word === "string" && wordKey(item.word) && item.word.length <= 200)
        .map(item => {
            const value = Number(item[dateField]);
            const date = Number.isFinite(value) && value > 0 ? value : Date.parse(item[dateField]);
            return { word: item.word.trim(), [dateField]: Number.isFinite(date) && date >= 0 && date <= Date.now() + 300000 ? date : 0 };
        });
}

async function fingerprint(value) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
    return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}

export async function migrateLibrary(userId, request = libraryRequest) {
    const saved = identityRecords(readStorage("wa:saved", []), "savedAt");
    const history = identityRecords(readStorage("wa:history", []), "visitedAt");
    const count = Math.max(saved.length, history.length);
    // Each request has <= 1,000 combined rows, so large old libraries resume
    // at a verified batch after a lost connection rather than starting over.
    for (let offset = 0; offset < count; offset += 500) {
        const body = { saved: saved.slice(offset, offset + 500), history: history.slice(offset, offset + 500) };
        const digest = await fingerprint(body);
        const marker = `wa:imported:v1:${userId}:${digest}`;
        if (readStorage(marker, false)) continue;
        const result = await request("/me/import", { method: "POST", body, operationId: `browser-${digest}` });
        if (result.verified !== true) throw new Error("Your browser library is preserved. Import verification is still pending.");
        writeStorage(marker, true);
    }
}

export function applyPending(items, operations, kind) {
    let result = [...items];
    for (const operation of operations) {
        if (kind === "history" && operation.kind === "clearHistory") result = [];
        if (kind === "saved" && ["save", "remove"].includes(operation.kind)) {
            result = result.filter(item => wordKey(item.word) !== wordKey(operation.word));
            if (operation.kind === "save") result.unshift({ word: operation.word, savedAt: operation.at, ...(operation.entryId ? { entryId: operation.entryId } : {}), pending: true });
        }
        if (kind === "history" && operation.kind === "history") {
            result = result.filter(item => wordKey(item.word) !== wordKey(operation.word));
            result.unshift({ word: operation.word, visitedAt: operation.at, pending: true });
        }
    }
    return result;
}
