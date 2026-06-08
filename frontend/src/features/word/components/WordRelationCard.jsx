import PillList from "../../../components/ui/PillList.jsx";

const WordRelationCard = ({ title, words, limit }) => {
    if (!words?.length) return null;

    return (
        <section className="rounded-md border border-primary/15 p-md">
            <h3 className="mb-md font-display text-body font-bold">{title}</h3>
            <PillList items={words} limit={limit} />
        </section>
    );
};

export default WordRelationCard;