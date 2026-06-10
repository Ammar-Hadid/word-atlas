const SuggestionItem = ({ query, suggestion, handleSearch }) => {
    const cleanQuery = query.trim().toLowerCase();
    const cleanSuggestion = suggestion.trim().toLowerCase();

    const startsWithQuery = cleanSuggestion.startsWith(cleanQuery);

    const suggestionItemClassList = `text-body font-display py-md px-md text-primary cursor-pointer bg-secondary transition-colors duration-200 ease-in-out hover:bg-state`

    if (!cleanQuery || !startsWithQuery) {
        return <p className={suggestionItemClassList}>{suggestion}</p>
    }

    const typedText = suggestion.slice(0, cleanQuery.length);
    const remainingText = suggestion.slice(cleanQuery.length);

    return (
        <p onClick={() => handleSearch(suggestion)} className={suggestionItemClassList}>
            <span className="text-primary/50">{typedText}</span>
            <span className="text-primary">{remainingText}</span>
        </p>
    );
};

export default SuggestionItem;