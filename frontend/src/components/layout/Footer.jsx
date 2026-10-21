import { Link } from "react-router-dom";

import LogoMark from "../ui/LogoMark.jsx";

const Footer = () => {
    return (
        <footer className="mt-4xl border-t border-line">
            <div className="container-page flex flex-col gap-xl py-2xl md:flex-row md:items-end md:justify-between">
                <div className="flex max-w-[24rem] flex-col gap-md">
                    <div className="flex items-center gap-sm">
                        <LogoMark className="h-6 w-6" />
                        <span className="display text-h5">Word <em className="italic text-muted">Atlas</em></span>
                    </div>
                    <p className="text-body-sm text-muted">
                        A modern lexicon for curious minds. Definitions, pronunciation,
                        origins and the web of meaning around every word.
                    </p>
                </div>

                <div className="flex flex-col gap-sm text-body-sm text-muted md:items-end">
                    <nav aria-label="Footer" className="flex gap-lg">
                        <Link to="/" className="hover:text-ink">Explore</Link>
                        <Link to="/library" className="hover:text-ink">Library</Link>
                        <a href="https://github.com/Ammar-Hadid/word-atlas" target="_blank" rel="noreferrer" className="hover:text-ink">Source</a>
                    </nav>
                    <p className="eyebrow normal-case tracking-normal">
                        Data from Merriam-Webster &amp; Datamuse · Crafted by{" "}
                        <a href="https://ammarhadid.com" target="_blank" rel="noreferrer" className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-accent">
                            Ammar Hadid
                        </a>
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
