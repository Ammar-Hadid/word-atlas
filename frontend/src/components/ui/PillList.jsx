import Pill from "./Pill.jsx";
import { useState } from "react";

const PillList = ({ items, limit = items?.length ?? 0 }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!items?.length) return null;

    const visibleItems = isExpanded ? items : items.slice(0, limit)
    const hiddenItemsCount = items.length - visibleItems.length;

    return (
        <div className="flex flex-wrap items-center gap-sm">
            {visibleItems.map((item, index) => (
                <Pill key={index}>{item}</Pill>
            ))}

            {hiddenItemsCount > 0 && (
                <button
                    onClick={() => setIsExpanded(true)}
                    className=" border-0 bg-transparent text-body text-primary cursor-pointer underline">
                    + more
                </button>
            )}
        </div>
    );
};

export default PillList;