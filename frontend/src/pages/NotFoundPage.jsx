import { Link } from "react-router-dom";

import { useDocumentTitle } from "../lib/useDocumentTitle.js";

const NotFoundPage = () => {
    useDocumentTitle("Page not found");

    return (
        <section className="relative overflow-hidden">
            <div className="atlas-grid pointer-events-none absolute inset-0" aria-hidden="true" />
            <div className="container-page relative flex min-h-[60vh] flex-col items-start justify-center gap-lg py-3xl">
                <span className="eyebrow">Error 404</span>
                <h1 className="display text-h1 leading-none">
                    This page is <em className="italic text-accent">off the map.</em>
                </h1>
                <p className="max-w-[28rem] text-body-lg text-muted">The address may be mistyped, or the page has moved.</p>
                <Link to="/" className="rounded-full bg-ink px-lg py-sm text-body-sm text-paper transition-colors hover:bg-accent hover:text-accent-ink">
                    Return to the atlas
                </Link>
            </div>
        </section>
    );
};

export default NotFoundPage;
