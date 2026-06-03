import Header from "./Header.jsx"

const Layout = ({ children }) => {
    return (
        <>
            <Header />
            <main className="px-3xl">
                {children}
            </main>
        </>
    )
}

export default Layout;