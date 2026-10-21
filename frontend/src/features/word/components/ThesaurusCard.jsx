import InsightCard from "./InsightCard.jsx";
import WordChip from "../../../components/ui/WordChip.jsx";

const ChipSkeleton = () => (
    <div className="flex flex-wrap gap-xs">
        {[64, 88, 72, 56, 80].map(width => <span key={width} className="skeleton h-7 rounded-full" style={{ width }} />)}
    </div>
);

const ThesaurusCard = ({ insights, isLoading }) => {
    const synonyms = insights.synonyms.length ? insights.synonyms : insights.similar;

    if (!isLoading && !synonyms.length && !insights.antonyms.length) return null;

    return (
        <InsightCard eyebrow="Thesaurus">
            <div className="flex flex-col gap-sm">
                <h3 className="text-body-sm font-medium">{insights.synonyms.length || isLoading ? "Synonyms" : "Similar words"}</h3>
                {isLoading ? <ChipSkeleton /> : (
                    <div className="flex flex-wrap gap-xs">
                        {synonyms.slice(0, 12).map(word => <WordChip key={word} word={word} variant="accent" />)}
                    </div>
                )}
            </div>

            {insights.antonyms.length > 0 && (
                <div className="flex flex-col gap-sm border-t border-line pt-md">
                    <h3 className="text-body-sm font-medium">Antonyms</h3>
                    <div className="flex flex-wrap gap-xs">
                        {insights.antonyms.slice(0, 8).map(word => <WordChip key={word} word={word} variant="ghost" />)}
                    </div>
                </div>
            )}
        </InsightCard>
    );
};

export default ThesaurusCard;
