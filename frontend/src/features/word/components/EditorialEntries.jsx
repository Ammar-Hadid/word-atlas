import { useState } from "react";
import SenseList from "./SenseList.jsx";
import PhraseList from "./PhraseList.jsx";
import SourceNote from "./SourceNote.jsx";
import { libraryRequest } from "../../../lib/libraryApi.js";
import { getHighlightTerms } from "../utils/entries.js";

const EditorialEntries = ({ entry }) => {
    const [result, setResult] = useState(null);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState(null);
    const load = async () => {
        setPending(true);
        setError(null);
        try { setResult(await libraryRequest(`/entries/${encodeURIComponent(entry.id)}/enrichment`)); }
        catch { setError("Additional definitions could not load. Try again when your connection is available."); }
        finally { setPending(false); }
    };
    return (
        <div className="flex flex-col gap-md border-t border-line pt-lg">
            {!result && <button type="button" disabled={pending} onClick={load}
                className="self-start rounded-full border border-line-strong px-lg py-sm text-body-sm transition-colors hover:border-ink hover:bg-ink hover:text-paper disabled:opacity-50">
                {pending ? "Checking Merriam-Webster…" : "View Merriam-Webster definitions"}
            </button>}
            {error && <p role="status" className="text-body-sm text-muted">{error}</p>}
            {result && !result.word?.length && <p role="status" className="text-body-sm text-muted">
                {Object.values(result.availability ?? {}).some(state => ["unavailable", "timeout", "allowance_exhausted"].includes(state))
                    ? "The additional dictionary is unavailable right now. The meanings above remain available."
                    : "No additional definition is available for this entry."}
            </p>}
            {(result?.word ?? []).map(item => (
                <article key={item.id} className="flex flex-col gap-md">
                    <header className="flex flex-col gap-xs">
                        <h3 className="display text-h4">{item.word} <span className="text-muted italic">{item.partOfSpeech}</span></h3>
                        <SourceNote source={item.source} />
                    </header>
                    <SenseList entry={item} terms={getHighlightTerms(item)} />
                    {item.phrases?.length > 0 && <PhraseList phrases={item.phrases} terms={getHighlightTerms(item)} />}
                </article>
            ))}
        </div>
    );
};
export default EditorialEntries;
