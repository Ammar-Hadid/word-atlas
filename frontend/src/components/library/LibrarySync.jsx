import { useState } from "react";
import { useLibrary, useToast } from "../../context/contexts.js";

const button = "rounded-full border border-line px-md py-sm text-body-sm transition-colors hover:border-ink hover:text-ink disabled:opacity-50";

// Sync status for the signed-in owner. Visitors never see it: their library simply
// lives on their device, and nothing on the site hints that a sign-in exists.
const LibrarySync = () => {
    const { user, logout, synchronize, syncState, syncError, offlineStorageAvailable, pendingCount } = useLibrary();
    const notify = useToast();
    const [busy, setBusy] = useState(false);

    if (!user) return null;

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
                    {syncState === "synced" ? "Your library is synchronized across devices."
                        : syncState === "syncing" ? "Synchronizing your library…"
                            : `${pendingCount ? `${pendingCount} pending ${pendingCount === 1 ? "change" : "changes"}. ` : ""}Your device keeps your changes until synchronization succeeds.`}
                </p>
                <div className="flex items-center gap-sm">
                    {syncState === "pending" && <button type="button" className={button} onClick={() => void synchronize()}>Retry sync</button>}
                    <button type="button" className={button} disabled={busy} onClick={signOut}>Sign out</button>
                </div>
            </div>
            {!offlineStorageAvailable && <p role="alert" className="text-body-sm text-accent">This browser cannot retain offline changes. Keep this tab open until synchronization succeeds.</p>}
            {syncError && <p role="alert" className="text-body-sm text-accent">{syncError}</p>}
        </div>
    );
};

export default LibrarySync;
