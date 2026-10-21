import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

import Header from "./Header.jsx";
import Footer from "./Footer.jsx";

const Layout = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, [pathname]);

    return (
        <div className="flex min-h-dvh flex-col">
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-md focus:top-md focus:z-50 focus:rounded-full focus:bg-ink focus:px-md focus:py-sm focus:text-paper">
                Skip to content
            </a>
            <Header />
            <main id="main" className="flex-1">
                <Outlet />
            </main>
            <Footer />
        </div>
    );
};

export default Layout;
