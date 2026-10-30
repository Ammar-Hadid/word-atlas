import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

import { libraryRequest, readSession } from "./libraryApi.js";

// The secret path segment is sent with every call; without it the server answers 404.
export const checkGate = gate => libraryRequest(`/auth/passkey/gate?gate=${encodeURIComponent(gate)}`)
    .then(() => true, error => error.status === 404 ? false : Promise.reject(error));

export async function signInWithPasskey(gate) {
    await readSession();
    const optionsJSON = await libraryRequest("/auth/passkey/login/options", { method: "POST", body: { gate } });
    const response = await startAuthentication({ optionsJSON });
    return libraryRequest("/auth/passkey/login/verify", { method: "POST", body: { gate, response } });
}

export async function createPasskey(gate, token) {
    await readSession();
    const optionsJSON = await libraryRequest("/auth/passkey/setup/options", { method: "POST", body: { gate, token } });
    const response = await startRegistration({ optionsJSON });
    return libraryRequest("/auth/passkey/setup/verify", { method: "POST", body: { gate, token, response } });
}
