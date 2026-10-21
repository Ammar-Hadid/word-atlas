const SectionHeading = ({ eyebrow, title, action, className = "" }) => {
    return (
        <div className={`flex items-end justify-between gap-md border-b border-line pb-md ${className}`}>
            <div className="flex flex-col gap-xs">
                {eyebrow && <span className="eyebrow">{eyebrow}</span>}
                <h2 className="display text-h4">{title}</h2>
            </div>
            {action}
        </div>
    );
};

export default SectionHeading;
