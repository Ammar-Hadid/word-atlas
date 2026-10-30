import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { KeyRound, LoaderCircle } from "lucide-react";

import { useLibrary } from "../context/contexts.js";
import { checkGate, createPasskey, signInWithPasskey } from "../lib/passkeyApi.js";
import { useDocumentTitle } from "../lib/useDocumentTitle.js";
import NotFoundPage from "./NotFoundPage.jsx";

const primary = "flex h-11 w-fit items-center gap-sm rounded-full bg-ink pl-base pr-lg text-body-sm font-medium text-paper transition-colors hover:bg-accent hover:text-accent-ink disabled:opacity-60";

const describe = error => error?.name === "NotAllowedError"
    ? "The passkey prompt was closed. Try again when you're ready."
    : error?.message || "Something went wrong. Try again.";

// The owner's sign-in page. It only exists at a secret path; any other path
// renders the ordinary 404, so visitors can't tell there is a sign-in at all.
const PasskeyPage = () => {
    const { gate } = useParams();
    const [params, setParams] = useSearchParams();
    const setupToken = params.get("setup");
    const navigate = useNavigate();
    const { user, authReady, completeSignIn, logout } = useLibrary();
    const [gateState, setGateState] = useState("checking");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useDocumentTitle(null, gateState === "open");

    useEffect(() => {
        let active = true;
        checkGate(gate).then(open => { if (active) setGateState(open ? "open" : "closed"); },
            () => { if (active) setGateState("closed"); });
        return () => { active = false; };
    }, [gate]);

    // Keep the page out of search results even if the address ever leaks.
    useEffect(() => {
        const meta = Object.assign(document.createElement("meta"), { name: "robots", content: "noindex, nofollow" });
        document.head.append(meta);
        return () => meta.remove();
    }, []);

    if (gateState === "checking") return <section className="min-h-[60vh]" aria-busy="true" />;
    if (gateState === "closed") return <NotFoundPage />;

    const run = async action => {
        setBusy(true);
        setError(null);
        try {
            await completeSignIn(await action());
            if (setupToken) setParams({}, { replace: true });
            navigate("/library", { replace: true });
        }
        catch (error) { setError(describe(error)); }
        finally { setBusy(false); }
    };

    const isSetup = Boolean(setupToken);
    const signedIn = authReady && user && !isSetup;

    return (
        <section className="relative overflow-hidden">
            <div className="atlas-grid pointer-events-none absolute inset-0" aria-hidden="true" />
            <div className="container-page relative flex min-h-[60vh] flex-col items-start justify-center gap-lg py-3xl">
                <span className="eyebrow">Owner</span>
                <h1 className="display text-h1 leading-none">
                    {isSetup ? <>Create your <em className="italic text-accent">passkey.</em></>
                        : signedIn ? <>You're <em className="italic text-accent">signed in.</em></>
                            : <>Welcome <em className="italic text-accent">back.</em></>}
                </h1>
                <p className="max-w-[30rem] text-body-lg text-muted">
                    {isSetup ? "Save a passkey for Word Atlas on this device with Touch ID, Face ID or your password manager. This link works once."
                        : signedIn ? "Your library is synchronizing across your devices."
                            : "Sign in with your passkey to synchronize your library."}
                </p>

                {signedIn ? (
                    <div className="flex flex-wrap items-center gap-sm">
                        <Link to="/library" className={primary}>Open your library</Link>
                        <button type="button" onClick={() => void logout()} className="rounded-full border border-line px-md py-sm text-body-sm transition-colors hover:border-ink hover:text-ink">Sign out</button>
                    </div>
                ) : (
                    <button
                        type="button"
                        disabled={busy || !authReady}
                        onClick={() => void run(() => isSetup ? createPasskey(gate, setupToken) : signInWithPasskey(gate))}
                        className={primary}
                    >
                        <span className="grid h-6 w-6 place-items-center">
                            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2} /> : <KeyRound className="h-4 w-4" strokeWidth={2} />}
                        </span>
                        {isSetup ? "Create passkey" : "Sign in with passkey"}
                    </button>
                )}

                {error && <p role="alert" className="text-body-sm text-accent">{error}</p>}
            </div>
        </section>
    );
};

export default PasskeyPage;
