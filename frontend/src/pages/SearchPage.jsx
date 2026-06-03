import SearchField from "../features/search/components/SearchField.jsx";
import SearchPageImage from "../assets/images/search-page-img.png";

const SearchPage = () => {

    return (
        <div className="flex justify-between items-start gap-3xl">
            <div className="flex flex-col gap-xl pt-40">
                <div>
                    <h1 className="font-display text-h1">Look up <span className="underline italic">any</span> word</h1>
                    <p className="text-primary-muted text-body-lg font-display">Search any word to explore its definition, pronunciation, and more.</p>
                </div>

                <SearchField />
            </div>

            <img
                src={SearchPageImage}
                aria-hidden="true"
                className="flex-1 max-w-[40%] h-auto"
            />
        </div>
    )
}

export default SearchPage;
