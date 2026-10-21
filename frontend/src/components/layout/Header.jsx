import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Search } from "lucide-react";

import Logo from "../ui/Logo.jsx";
import Kbd from "../ui/Kbd.jsx";
import ThemeToggle from "../ui/ThemeToggle.jsx";

import { useCommand, useLibrary } from "../../context/contexts.js";
import { modKey } from "../../lib/platform.js";

const navLinkClass = ({ isActive }) =>
    `relative rounded-full px-base py-xs text-body-sm transition-colors ${isActive ? "text-ink" : "text-muted hover:text-ink"}`;

const Header = () => {
    const { openPalette } = useCommand();
    const { saved } = useLibrary();
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setIsScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <header
            className={`sticky top-0 z-40 border-b transition-colors duration-300 ${isScrolled
                ? "border-line bg-paper/80 backdrop-blur-xl backdrop-saturate-150"
                : "border-transparent bg-paper"
                }`}
        >
            <div className="container-page flex h-16 items-center gap-md">
                <Logo />

                <nav aria-label="Main" className="ml-lg hidden items-center gap-2xs sm:flex">
                    <NavLink to="/" end className={navLinkClass}>Explore</NavLink>
                    <NavLink to="/library" className={navLinkClass}>
                        Library
                        {saved.length > 0 && (
                            <span className="ml-xs rounded-full bg-accent-soft px-1.5 py-px font-mono text-[0.625rem] text-accent">
                                {saved.length}
                            </span>
                        )}
                    </NavLink>
                </nav>

                <div className="ml-auto flex items-center gap-xs">
                    <button
                        type="button"
                        onClick={openPalette}
                        className="group hidden h-9 w-64 items-center gap-sm rounded-full border border-line bg-surface pl-base pr-xs text-body-sm text-muted transition-colors hover:border-line-strong md:flex"
                    >
                        <Search className="h-4 w-4" strokeWidth={1.75} />
                        <span className="flex-1 text-left">Search any word…</span>
                        <span className="flex gap-2xs">
                            <Kbd>{modKey}</Kbd>
                            <Kbd>K</Kbd>
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={openPalette}
                        aria-label="Search"
                        className="grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink md:hidden"
                    >
                        <Search className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.75} />
                    </button>

                    <NavLink
                        to="/library"
                        className={({ isActive }) => `rounded-full px-base py-xs text-body-sm sm:hidden ${isActive ? "text-ink" : "text-muted"}`}
                    >
                        Library
                    </NavLink>

                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
};

export default Header;
