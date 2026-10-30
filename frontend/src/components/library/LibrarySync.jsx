import { useState } from "react";
import { useLibrary, useToast } from "../../context/contexts.js";

const button = "rounded-full border border-line px-md py-sm text-body-sm transition-colors hover:border-ink hover:text-ink disabled:opacity-50";
const input = "h-10 min-w-0 rounded-full border border-line bg-surface px-md text-body-sm outline-none focus:border-ink";

const LibrarySync = () => {
    const { user, authReady, login, logout, synchronize, syncState, syncError, offlineStorageAvailable, pendingCount } = useLibrary();
    const notify = useToast();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const signIn = async event => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        const fields = new FormData(event.currentTarget);
        try {
            await login(fields.get("username"), fields.get("password"));
            setOpen(false);
        } catch (error) { setError(error.message); }
        finally { setBusy(false); }
    };
    const signOut = async () => {
        setBusy(true);
        try { await logout(); }
        catch (error) { notify(error.message); }
        finally { setBusy(false); }
    };
    return (
        <div className="flex flex-col gap-md rounded-2xl border border-line bg-surface p-md">
            <div className="flex flex-wrap items-center justify-between gap-sm">
                <p className="text-body-sm text-muted" role="status">
                    {!authReady ? "Checking your library…" : user
                        ? syncState === "synced" ? "Your library is synchronized across devices."
                            : syncState === "syncing" ? "Synchronizing your library…"
                                : `${pendingCount ? `${pendingCount} pending ${pendingCount === 1 ? "change" : "changes"}. ` : ""}Your device keeps your changes until synchronization succeeds.`
                        : "Your library is on this device. Sign in to keep it across devices."}
                </p>
                <div className="flex items-center gap-sm">
                    {user && syncState === "pending" && <button type="button" className={button} onClick={() => void synchronize()}>Retry sync</button>}
                    {user ? <button type="button" className={button} disabled={busy} onClick={signOut}>Sign out</button>
                        : <button type="button" className={button} disabled={!authReady} aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? "Close" : "Sign in"}</button>}
                </div>
            </div>
            {!offlineStorageAvailable && <p role="alert" className="text-body-sm text-accent">This browser cannot retain offline changes. Keep this tab open until synchronization succeeds.</p>}
            {(error || syncError) && <p role="alert" className="text-body-sm text-accent">{error || syncError}</p>}
            {!user && open && (
                <form onSubmit={signIn} className="grid gap-sm sm:grid-cols-[1fr_1fr_auto]">
                    <label className="flex min-w-0 flex-col gap-xs"><span className="eyebrow">Username</span>
                        <input className={input} name="username" autoComplete="username" required maxLength={80} />
                    </label>
                    <label className="flex min-w-0 flex-col gap-xs"><span className="eyebrow">Password</span>
                        <input className={input} type="password" name="password" autoComplete="current-password" required maxLength={128} />
                    </label>
                    <button type="submit" disabled={busy} className="h-10 self-end rounded-full bg-ink px-lg text-body-sm text-paper transition-colors hover:bg-accent hover:text-accent-ink disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
                    <p className="text-body-sm text-muted sm:col-span-3">Your existing browser words will be imported after sign-in. The original records remain on this device.</p>
                </form>
            )}
        </div>
    );
};

export default LibrarySync;
