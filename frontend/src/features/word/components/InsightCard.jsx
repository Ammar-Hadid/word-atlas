const InsightCard = ({ eyebrow, children, className = "" }) => {
    return (
        <section className={`flex flex-col gap-md rounded-2xl border border-line bg-surface p-lg ${className}`}>
            <h2 className="eyebrow">{eyebrow}</h2>
            {children}
        </section>
    );
};

export default InsightCard;
