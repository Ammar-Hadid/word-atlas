import InsightCard from "./InsightCard.jsx";

import { formatFrequency, getCommonness } from "../utils/commonness.js";

const Stat = ({ label, value }) => (
    <div className="flex flex-col gap-2xs">
        <dt className="text-[0.75rem] text-muted">{label}</dt>
        <dd className="display text-h5">{value ?? <span className="text-faint">—</span>}</dd>
    </div>
);

const GlanceCard = ({ entry, entries, insights, isLoading }) => {
    const commonness = getCommonness(insights.frequency);
    const partsOfSpeech = [...new Set(entries.map(item => item.partOfSpeech).filter(Boolean))];
    const syllableCount = insights.syllableCount ?? (entry.syllables?.length || null);

    return (
        <InsightCard eyebrow="At a glance">
            <div className="flex flex-col gap-sm">
                <div className="flex items-end justify-between gap-md">
                    <span className="display text-h4">
                        {isLoading ? <span className="skeleton inline-block h-7 w-28 align-middle" /> : commonness?.label ?? "Unranked"}
                    </span>
                    {commonness && (
                        <span className="font-mono text-[0.6875rem] text-muted">
                            {formatFrequency(insights.frequency)} / million
                        </span>
                    )}
                </div>

                <div className="flex gap-xs" role="img" aria-label={commonness ? `Commonness: ${commonness.level} of 5` : "Commonness unknown"}>
                    {[1, 2, 3, 4, 5].map(level => (
                        <span
                            key={level}
                            className={`h-1.5 flex-1 rounded-full transition-colors duration-700 ${commonness && level <= commonness.level ? "bg-accent" : "bg-sunken"}`}
                            style={{ transitionDelay: `${level * 80}ms` }}
                        />
                    ))}
                </div>

                {commonness && <p className="text-body-sm text-muted">{commonness.note}</p>}
            </div>

            <dl className="grid grid-cols-2 gap-md border-t border-line pt-md">
                <Stat label="First known use" value={entry.firstKnownUse} />
                <Stat label="Syllables" value={syllableCount} />
                <div className="col-span-2">
                    <Stat label="Parts of speech" value={partsOfSpeech.length ? partsOfSpeech.join(", ") : null} />
                </div>
            </dl>
        </InsightCard>
    );
};

export default GlanceCard;
