import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LibraryContext } from "./contexts.js";
import { readStorage } from "../lib/storage.js";
import { libraryRequest, readSession } from "../lib/libraryApi.js";
import { acknowledgeOutboxOperation, applyPending, compareOutboxOperations, isOutboxStorageKey, migrateLibrary, persistOutboxOperation, readOutbox, wordKey } from "../lib/migrateLibrary.js";

const emptyPages = () => ({ saved: { total: 0, nextOffset: null }, history: { total: 0, nextOffset: null } });
const legacy = key => {
    const items = readStorage(key, []);
    return Array.isArray(items) ? items.filter(item => typeof item?.word === "string") : [];
};
const LibraryProvider = ({ children }) => {
    const [baseSaved, setBaseSaved] = useState(() => legacy("wa:saved"));
    const [baseHistory, setBaseHistory] = useState(() => legacy("wa:history"));
    const [outbox, setOutbox] = useState(readOutbox);
    const outboxRef = useRef(outbox);
    const volatileOperations = useRef(new Map());
    const syncing = useRef(null);
    const userRef = useRef(null);
    const sessionGeneration = useRef(0);
    const [user, setUser] = useState(null);
    const [authReady, setAuthReady] = useState(false);
    const [syncState, setSyncState] = useState("checking");
    const [syncError, setSyncError] = useState(null);
    const [offlineStorageAvailable, setOfflineStorageAvailable] = useState(true);
    const [pages, setPages] = useState(emptyPages);
    const [memberships, setMemberships] = useState({});
    const [membershipRevision, setMembershipRevision] = useState(0);
    const membershipRequest = useRef(0);

    const refreshOutbox = useCallback(() => {
        const itemsById = new Map(readOutbox().map(item => [item.id, item]));
        for (const [id, item] of volatileOperations.current) if (!itemsById.has(id)) itemsById.set(id, item);
        const items = [...itemsById.values()].sort(compareOutboxOperations);
        outboxRef.current = items;
        setOutbox(items);
        return items;
    }, []);
    const persistOperation = useCallback(item => {
        const durable = persistOutboxOperation(item);
        if (durable) volatileOperations.current.delete(item.id);
        else volatileOperations.current.set(item.id, item);
        setOfflineStorageAvailable(durable && volatileOperations.current.size === 0);
        refreshOutbox();
    }, [refreshOutbox]);
    const acknowledgeOperation = useCallback(id => {
        if (!acknowledgeOutboxOperation(id)) {
            setOfflineStorageAvailable(false);
            throw new Error("Your change reached the server, but this browser could not update its offline queue. Keep this tab open and retry synchronization.");
        }
        volatileOperations.current.delete(id);
        refreshOutbox();
    }, [refreshOutbox]);

    const currentSession = useCallback((principalId, generation) => userRef.current?.id === principalId && sessionGeneration.current === generation, []);

    const load = useCallback(async (principalId, generation) => {
        const [saved, history] = await Promise.all([
            libraryRequest("/me/library?limit=100"), libraryRequest("/me/history?limit=100"),
        ]);
        if (!currentSession(principalId, generation)) return;
        setBaseSaved(saved.items);
        setBaseHistory(history.items);
        setPages({ saved: { total: saved.total, nextOffset: saved.nextOffset }, history: { total: history.total, nextOffset: history.nextOffset } });
        membershipRequest.current++;
        setMemberships(Object.fromEntries(saved.items.map(item => [wordKey(item.word), true])));
        setMembershipRevision(value => value + 1);
    }, [currentSession]);

    const resetPrivateState = useCallback(() => {
        sessionGeneration.current++;
        membershipRequest.current++;
        userRef.current = null;
        setUser(null);
        setBaseSaved(legacy("wa:saved"));
        setBaseHistory(legacy("wa:history"));
        setMemberships({});
        setPages(emptyPages());
        setMembershipRevision(value => value + 1);
    }, []);

    const synchronize = useCallback(async (principal = userRef.current) => {
        if (!principal) return false;
        if (syncing.current) return syncing.current;
        const generation = sessionGeneration.current;
        const run = async () => {
            if (!currentSession(principal.id, generation)) return false;
            setSyncState("syncing");
            setSyncError(null);
            try {
                await migrateLibrary(principal.id);
                // Guest changes become this owner's pending changes at sign-in.
                do {
                while (true) {
                    if (!currentSession(principal.id, generation)) return false;
                    let item = refreshOutbox().find(item => !item.ownerId || item.ownerId === principal.id);
                    if (!item) break;
                    if (!item.ownerId) {
                        item = { ...item, ownerId: principal.id };
                        persistOperation(item);
                    }
                    const paths = { save: `/me/library/${encodeURIComponent(item.word ?? "")}`, remove: `/me/library/${encodeURIComponent(item.word ?? "")}`, history: "/me/history", clearHistory: "/me/history" };
                    const methods = { save: "PUT", remove: "DELETE", history: "POST", clearHistory: "DELETE" };
                    await libraryRequest(paths[item.kind], { method: methods[item.kind], operationId: item.id,
                        ...(item.kind === "save" ? { body: { word: item.word, savedAt: item.at, ...(item.entryId ? { entryId: item.entryId } : {}) } } : {}),
                        ...(item.kind === "history" ? { body: { word: item.word, visitedAt: item.at } } : {}),
                    });
                    acknowledgeOperation(item.id);
                    if (!currentSession(principal.id, generation)) return false;
                    if (["save", "remove"].includes(item.kind)) {
                        setMemberships(current => ({ ...current, [wordKey(item.word)]: item.kind === "save" }));
                        setBaseSaved(current => applyPending(current, [item], "saved").map(record => ({ ...record, pending: false })));
                    } else setBaseHistory(current => applyPending(current, [item], "history").map(record => ({ ...record, pending: false })));
                }
                await load(principal.id, generation);
                } while (currentSession(principal.id, generation) && refreshOutbox().some(item => !item.ownerId || item.ownerId === principal.id));
                if (!currentSession(principal.id, generation)) return false;
                setSyncState("synced");
                return true;
            } catch (error) {
                if (!currentSession(principal.id, generation)) return false;
                if (error.status === 401) {
                    resetPrivateState();
                    await readSession().catch(() => {});
                }
                setSyncState("pending");
                setSyncError(error.message);
                return false;
            }
        };
        // One browser-wide drain keeps save/remove order across tabs. Unique
        // operation keys still protect durability where Web Locks are absent;
        // stable server idempotency keys make duplicate delivery safe.
        const task = navigator.locks ? navigator.locks.request("wa:library-sync", run) : run();
        syncing.current = task.finally(() => { syncing.current = null; });
        return syncing.current;
    }, [acknowledgeOperation, currentSession, load, persistOperation, refreshOutbox, resetPrivateState]);

    useEffect(() => {
        let active = true;
        readSession().then(session => {
            if (!active) return;
            userRef.current = session.user;
            setUser(session.user);
            setAuthReady(true);
            if (session.user) void synchronize(session.user);
            else setSyncState("local");
        }).catch(error => {
            if (!active) return;
            setAuthReady(true);
            setSyncState("pending");
            setSyncError(error.message);
        });
        const refresh = () => { refreshOutbox(); if (userRef.current) void synchronize(); };
        const onStorage = event => { if (isOutboxStorageKey(event.key)) refresh(); };
        window.addEventListener("online", refresh);
        window.addEventListener("focus", refresh);
        window.addEventListener("storage", onStorage);
        return () => {
            active = false;
            window.removeEventListener("online", refresh);
            window.removeEventListener("focus", refresh);
            window.removeEventListener("storage", onStorage);
        };
    }, [refreshOutbox, synchronize]);

    const relevant = outbox.filter(item => !item.ownerId || item.ownerId === user?.id);
    const saved = useMemo(() => applyPending(baseSaved, outbox.filter(item => !item.ownerId || item.ownerId === user?.id), "saved"), [baseSaved, outbox, user]);
    const history = useMemo(() => applyPending(baseHistory, outbox.filter(item => !item.ownerId || item.ownerId === user?.id), "history"), [baseHistory, outbox, user]);

    const isSaved = useCallback(word => {
        const key = wordKey(word);
        const pending = outbox.filter(item => (!item.ownerId || item.ownerId === user?.id) && wordKey(item.word ?? "") === key && ["save", "remove"].includes(item.kind)).at(-1);
        if (pending) return pending.kind === "save";
        return memberships[key] ?? saved.some(item => wordKey(item.word) === key);
    }, [memberships, outbox, saved, user]);

    const checkSaved = useCallback(async word => {
        if (!userRef.current) return;
        const generation = ++membershipRequest.current;
        const principalId = userRef.current.id;
        try {
            const { item } = await libraryRequest(`/me/library/${encodeURIComponent(word)}`);
            if (generation === membershipRequest.current && principalId === userRef.current?.id) {
                setMemberships(current => ({ ...current, [wordKey(word)]: Boolean(item) }));
            }
        } catch { /* Existing known state remains usable while offline. */ }
    }, []);

    const enqueue = useCallback(async (kind, word, at = Date.now(), operationId, entryId) => {
        const id = operationId ?? crypto.randomUUID();
        if (!refreshOutbox().some(item => item.id === id)) persistOperation({ id, kind, word, at, queuedAt: Date.now(), ...(entryId ? { entryId } : {}), ownerId: userRef.current?.id ?? null });
        if (!userRef.current) { setSyncState("local"); return false; }
        return synchronize();
    }, [persistOperation, refreshOutbox, synchronize]);

    const toggleSaved = useCallback(async entry => {
        const next = !isSaved(entry.word);
        const localId = /^[a-f0-9]{64}$/.test(entry.entryId ?? "") ? entry.entryId : undefined;
        const synced = await enqueue(next ? "save" : "remove", entry.word, undefined, undefined, localId);
        return { saved: next, pending: !synced };
    }, [enqueue, isSaved]);
    const removeSaved = useCallback(word => enqueue("remove", word), [enqueue]);
    const recordVisit = useCallback(entry => enqueue("history", entry.word, entry.visitedAt, entry.operationId), [enqueue]);
    const clearHistory = useCallback(() => enqueue("clearHistory"), [enqueue]);

    const login = useCallback(async (username, password) => {
        sessionGeneration.current++;
        await readSession();
        const session = await libraryRequest("/auth/login", { method: "POST", body: { username, password } });
        userRef.current = session.user;
        setUser(session.user);
        await synchronize(session.user);
    }, [synchronize]);
    const logout = useCallback(async () => {
        sessionGeneration.current++;
        if (syncing.current) await syncing.current;
        await libraryRequest("/auth/logout", { method: "POST" });
        resetPrivateState();
        setSyncState("local");
        await readSession().catch(error => setSyncError(error.message));
    }, [resetPrivateState]);

    const loadMore = useCallback(async kind => {
        const principalId = userRef.current?.id;
        const generation = sessionGeneration.current;
        if (!principalId) return;
        const offset = pages[kind].nextOffset;
        if (offset === null || offset === undefined) return;
        const page = await libraryRequest(`/me/${kind === "saved" ? "library" : "history"}?limit=100&offset=${offset}`);
        if (!currentSession(principalId, generation)) return;
        const setter = kind === "saved" ? setBaseSaved : setBaseHistory;
        setter(current => [...current, ...page.items.filter(item => !current.some(existing => wordKey(existing.word) === wordKey(item.word)))]);
        setPages(current => ({ ...current, [kind]: { total: page.total, nextOffset: page.nextOffset } }));
    }, [currentSession, pages]);

    const value = useMemo(() => ({ saved, history, isSaved, checkSaved, membershipRevision, toggleSaved, removeSaved, recordVisit, clearHistory,
        user, authReady, login, logout, synchronize, syncState, syncError, offlineStorageAvailable, pendingCount: relevant.length, pages, loadMore,
    }), [saved, history, isSaved, checkSaved, membershipRevision, toggleSaved, removeSaved, recordVisit, clearHistory, user, authReady, login, logout,
        synchronize, syncState, syncError, offlineStorageAvailable, relevant.length, pages, loadMore]);
    return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
};

export default LibraryProvider;
