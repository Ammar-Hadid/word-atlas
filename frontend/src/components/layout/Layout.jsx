import { Outlet, useLocation } from "react-router-dom";

import Header from "./Header.jsx"

const Layout = () => {
    const location = useLocation();
    const hasReturn = location.pathname !== "/"
    return (
        <>
            <Header hasReturn={hasReturn} />
            <main className="p-xl sm:px-3xl">
                <Outlet />
            </main>
        </>
    )
}

export default Layout;
