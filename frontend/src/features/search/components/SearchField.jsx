import { useState } from "react";

import { useSuggestions } from "../hooks/useSuggestions.js";

import { Search } from "lucide-react";

import SuggestionsWrapper from "./SuggestionsWrapper.jsx";


const SearchField = () => {
    const [query, setQuery] = useState('');
    const { suggestions, isLoading, error } = useSuggestions(query);

    return (
        <div className="flex flex-col gap-sm">
            <label className="flex items-center gap-md border border-primary rounded-sm px-lg">
                <Search strokeWidth={1} className="w-lg h-lg" />

                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search..."
                    className="text-body placeholder:font-light flex-1 py-md focus:outline-none"
                />
            </label>

            <SuggestionsWrapper
                query={query}
                suggestions={suggestions}
                isLoading={isLoading}
                error={error}
            />
        </div>
    )
}

export default SearchField