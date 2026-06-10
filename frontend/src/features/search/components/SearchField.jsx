import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useSuggestions } from "../hooks/useSuggestions.js";

import { Search } from "lucide-react";

import SuggestionsWrapper from "./SuggestionsWrapper.jsx";


const SearchField = () => {
    const [query, setQuery] = useState('');
    const { suggestions, isLoading, error } = useSuggestions(query);

    const navigate = useNavigate();

    const handleSearch = (searchTerm = query) => {
        const trimmedQuery = query.trim();

        if (trimmedQuery) {
            navigate(`/${encodeURIComponent(trimmedQuery)}`);
        }
    }

    const handleOnSubmit = (e) => {
        e.preventDefault();
        handleSearch();
    }

    return (
        <form className="flex flex-col gap-sm" onSubmit={handleOnSubmit}>
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
                handleSearch={handleSearch}
            />
        </form>
    )
}

export default SearchField