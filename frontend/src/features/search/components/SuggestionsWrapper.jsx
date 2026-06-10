import SuggestionItem from "./SuggestionItem.jsx";

const SuggestionsWrapper = ({ query, suggestions, isLoading, error, handleSearch }) => {
    const hasQuery = query.trim().length > 0;
    const hasSuggestions = suggestions.length > 0;

    if (!hasQuery) return null;

    return (
        <div
            className="
                bg-secondary
                border-2 border-primary rounded-md
                flex flex-col
                divide-y divide-primary/30
            "
        >
            {isLoading && (
                <p className="text-body font-display p-lg text-primary/60">
                    Suggestions loading...
                </p>
            )}

            {error && (
                <p className="text-body font-display p-lg text-primary/60">
                    {error}
                </p>
            )}

            {!isLoading && !error && !hasSuggestions && (
                <p className="text-body font-display p-lg text-primary/60">
                    No words found.
                </p>
            )}

            {!isLoading &&
                !error &&
                suggestions.map((suggestion) => (
                    <SuggestionItem
                        key={suggestion}
                        query={query}
                        suggestion={suggestion}
                        handleSearch={handleSearch}
                    />
                ))}
        </div>
    );
};

export default SuggestionsWrapper;