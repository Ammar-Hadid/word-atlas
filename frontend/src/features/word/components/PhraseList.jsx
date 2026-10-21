import { useState } from "react";
import { Search } from "lucide-react";

import highlightTerms from "../utils/highlightTerms.jsx";

const INITIAL_VISIBLE = 6;

const PhraseList = ({ phrases, terms }) => {
    const [filter, setFilter] = useState("");
    const [showAll, setShowAll] = useState(false);

    const items = phrases?.filter(phrase => phrase.phrase) ?? [];

    if (!items.length) return null;

    const normalizedFilter = filter.trim().toLowerCase();
    const matches = normalizedFilter
        ? items.filter(phrase => `${phrase.phrase} ${phrase.definition ?? ""}`.toLowerCase().includes(normalizedFilter))
        : items;

    const visible = showAll || normalizedFilter ? matches : matches.slice(0, INITIAL_VISIBLE);

    return (
        <div className="flex flex-col gap-md">
            {items.length > INITIAL_VISIBLE && (
                <label className="flex items-center gap-sm rounded-full border border-line bg-surface px-md transition-colors focus-within:border-ink">
                    <Search className="h-4 w-4 text-faint" strokeWidth={1.75} />
                    <input
                        value={filter}
                        onChange={event => setFilter(event.target.value)}
                        placeholder={`Filter ${items.length} phrases…`}
                        className="h-10 flex-1 bg-transparent text-body-sm outline-none placeholder:text-faint"
                    />
                </label>
            )}

            <ul className="divide-y divide-line border-y border-line">
                {visible.map(phrase => (
                    <li key={phrase.id} className="grid gap-xs py-md sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-lg">
                        <span className="display text-h5 leading-snug">{phrase.phrase}</span>
                        <div className="flex flex-col gap-xs">
                            {phrase.definition && <p className="text-body text-ink">{phrase.definition}</p>}
                            {phrase.examples?.[0] && (
                                <p className="display italic text-muted">{highlightTerms(phrase.examples[0], terms)}</p>
                            )}
                        </div>
                    </li>
                ))}

                {!visible.length && <li className="py-md text-body-sm text-muted">No phrases match &ldquo;{filter}&rdquo;.</li>}
            </ul>

            {!normalizedFilter && matches.length > INITIAL_VISIBLE && (
                <button
                    type="button"
                    onClick={() => setShowAll(value => !value)}
                    className="self-start text-body-sm text-muted underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-accent"
                >
                    {showAll ? "Show fewer" : `Show all ${matches.length} phrases`}
                </button>
            )}
        </div>
    );
};

export default PhraseList;
