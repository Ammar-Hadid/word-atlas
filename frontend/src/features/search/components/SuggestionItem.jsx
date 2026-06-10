const SuggestionItem = ({ query, suggestion, handleSearch }) => {
    const cleanQuery = query.trim().toLowerCase();
    const cleanSuggestion = suggestion.trim().toLowerCase();

    const startsWithQuery = cleanSuggestion.startsWith(cleanQuery);

    const suggestionItemClassList = `w-full text-left border-0 text-body font-display py-md px-md text-primary cursor-pointer bg-secondary transition-colors duration-200 ease-in-out hover:bg-state`

    if (!cleanQuery || !startsWithQuery) {
        return (
            <button type="button" onClick={() => handleSearch(suggestion)} className={suggestionItemClassList}>
                {suggestion}
            </button>
        );
    }

    const typedText = suggestion.slice(0, cleanQuery.length);
    const remainingText = suggestion.slice(cleanQuery.length);

    return (
        <button type="button" onClick={() => handleSearch(suggestion)} className={suggestionItemClassList}>
            <span className="text-primary/50">{typedText}</span>
            <span className="text-primary">{remainingText}</span>
        </button>
    );
};

export default SuggestionItem;
