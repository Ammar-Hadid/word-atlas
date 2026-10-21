import InsightCard from "./InsightCard.jsx";

const OriginCard = ({ entry, entries }) => {
    const etymology = entry.etymology ?? entries.find(item => item.etymology)?.etymology;

    if (!etymology) return null;

    return (
        <InsightCard eyebrow="Origin">
            <p className="display text-body-lg leading-relaxed">{etymology}</p>
        </InsightCard>
    );
};

export default OriginCard;
