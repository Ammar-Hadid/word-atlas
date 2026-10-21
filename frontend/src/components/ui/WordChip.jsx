import { Link } from "react-router-dom";

import { wordPath } from "../../lib/platform.js";

const variants = {
    default: "border-line bg-surface text-ink hover:border-ink",
    accent: "border-transparent bg-accent-soft text-accent hover:bg-accent hover:text-accent-ink",
    ghost: "border-line bg-transparent text-muted hover:border-ink hover:text-ink",
};

const WordChip = ({ word, variant = "default", className = "" }) => {
    return (
        <Link
            to={wordPath(word)}
            className={`inline-flex items-center rounded-full border px-base py-[0.3rem] text-body-sm transition-colors duration-200 ${variants[variant]} ${className}`}
        >
            {word}
        </Link>
    );
};

export default WordChip;
