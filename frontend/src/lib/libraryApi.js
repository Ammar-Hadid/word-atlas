let csrfToken = null;
const API = "/api";

export async function libraryRequest(path, { method = "GET", body, operationId, signal } = {}) {
    let response;
    try {
        response = await fetch(`${API}${path}`, {
            method, credentials: "same-origin", signal: signal ?? AbortSignal.timeout(15000),
            headers: {
                ...(body === undefined ? {} : { "Content-Type": "application/json" }),
                ...(method === "GET" ? {} : { "X-CSRF-Token": csrfToken ?? "" }),
                ...(operationId ? { "Idempotency-Key": operationId } : {}),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
    } catch (cause) {
        if (cause.name === "AbortError" && signal?.aborted) throw cause;
        throw new Error("Your changes are pending. Connect again to synchronize.", { cause });
    }
    const data = await response.json().catch(() => ({}));
    if (data.csrfToken) csrfToken = data.csrfToken;
    if (!response.ok) {
        const error = new Error(data.error || "Synchronization is unavailable. Your changes are pending.");
        error.status = response.status;
        throw error;
    }
    return data;
}

export const readSession = () => libraryRequest("/auth/me");

export async function downloadLibrary() {
    const data = await libraryRequest("/me/export");
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: "word-atlas-library.json" });
    link.click();
    URL.revokeObjectURL(url);
}
