import { Link } from "react-router-dom";

import LogoMark from "./LogoMark.jsx";

const Logo = ({ className = "" }) => {
    return (
        <Link to="/" aria-label="Word Atlas home" className={`group flex items-center gap-sm ${className}`}>
            <LogoMark className="h-7 w-7 transition-transform duration-500 ease-out-expo group-hover:rotate-45" />
            <span className="display text-[1.3rem] leading-none">
                Word <em className="italic text-muted">Atlas</em>
            </span>
        </Link>
    );
};

export default Logo;
