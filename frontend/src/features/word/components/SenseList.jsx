import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import highlightTerms from "../utils/highlightTerms.jsx";

const INITIAL_VISIBLE = 6;

const Tag = ({ children }) => (
    <span className="rounded-md border border-line px-sm py-2xs font-mono text-[0.6875rem] uppercase tracking-wider text-muted">
        {children}
    </span>
);

const Sense = ({ sense, number, terms }) => {
    const tags = [sense.grammar, ...(sense.labels ?? [])].filter(Boolean);

    return (
        <div className="grid grid-cols-[2.5rem_1fr] gap-md py-lg sm:grid-cols-[3.5rem_1fr]">
            <span className="display pt-[0.15rem] text-h5 tabular-nums text-faint">
                {String(number).padStart(2, "0")}
            </span>

            <div className="flex flex-col gap-md">
                {tags.length > 0 && (
                    <div className="flex flex-wrap gap-xs">
                        {tags.map(tag => <Tag key={tag}>{tag}</Tag>)}
                    </div>
                )}

                {sense.definition && <p className="text-body-lg leading-relaxed text-ink">{sense.definition}</p>}

                {sense.examples.length > 0 && (
                    <ul className="flex flex-col gap-sm border-l-2 border-accent-soft pl-md">
                        {sense.examples.slice(0, 3).map(example => (
                            <li key={example} className="display text-body-lg italic leading-relaxed text-muted">
                                {highlightTerms(example, terms)}
                            </li>
                        ))}
                    </ul>
                )}

                {sense.usageNotes.map((usage, index) => (
                    <div key={index} className="flex flex-col gap-xs rounded-lg bg-sunken/70 p-md">
                        <span className="eyebrow">Usage</span>
                        {usage.note && <p className="text-body-sm text-ink">{usage.note}</p>}
                        {usage.examples.slice(0, 2).map(example => (
                            <p key={example} className="display italic text-muted">{highlightTerms(example, terms)}</p>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

const SenseList = ({ entry, terms }) => {
    const [showAll, setShowAll] = useState(false);

    const senses = entry.senses.flatMap(group =>
        group.senses.map((sense, index) => ({
            ...sense,
            heading: index === 0 ? group.heading?.heading : null,
        }))
    ).filter(sense => sense.definition || sense.examples.length);

    const visible = showAll ? senses : senses.slice(0, INITIAL_VISIBLE);
    const hiddenCount = senses.length - visible.length;

    return (
        <div className="flex flex-col">
            <ol>
                <AnimatePresence initial={false}>
                    {visible.map((sense, index) => (
                        <motion.li
                            key={sense.id}
                            className="border-t border-line first:border-t-0"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: index >= INITIAL_VISIBLE ? (index - INITIAL_VISIBLE) * 0.03 : 0 }}
                        >
                            {sense.heading && (
                                <p className="eyebrow pt-lg text-accent">{sense.heading}</p>
                            )}
                            <Sense sense={sense} number={index + 1} terms={terms} />
                        </motion.li>
                    ))}
                </AnimatePresence>
            </ol>

            {(hiddenCount > 0 || showAll) && senses.length > INITIAL_VISIBLE && (
                <button
                    type="button"
                    onClick={() => setShowAll(value => !value)}
                    className="mt-md self-start rounded-full border border-line-strong px-lg py-sm text-body-sm transition-colors hover:border-ink hover:bg-ink hover:text-paper"
                >
                    {showAll ? "Show fewer senses" : `Show all ${senses.length} senses`}
                </button>
            )}
        </div>
    );
};

export default SenseList;
