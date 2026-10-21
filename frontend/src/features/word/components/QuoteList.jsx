import highlightTerms from "../utils/highlightTerms.jsx";

const QuoteList = ({ quotes, terms }) => {
    if (!quotes?.length) return null;

    return (
        <div className="grid gap-md md:grid-cols-2">
            {quotes.slice(0, 4).map((quote, index, list) => (
                <figure key={index} className={`${index === 0 && list.length % 2 === 1 ? "md:col-span-2" : ""} flex flex-col justify-between gap-lg rounded-2xl border border-line bg-surface p-lg`}>
                    <blockquote className="display text-body-lg leading-relaxed">
                        <span aria-hidden="true" className="display mr-xs text-h3 leading-none text-accent">&ldquo;</span>
                        {highlightTerms(quote.text, terms)}
                    </blockquote>
                    <figcaption className="flex flex-col gap-2xs border-t border-line pt-md text-body-sm">
                        {quote.author && <span className="font-medium text-ink">{quote.author}</span>}
                        <span className="text-muted">{[quote.source, quote.date].filter(Boolean).join(", ")}</span>
                    </figcaption>
                </figure>
            ))}
        </div>
    );
};

export default QuoteList;
