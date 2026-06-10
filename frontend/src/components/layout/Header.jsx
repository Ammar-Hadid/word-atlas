import Logo from "../ui/Logo.jsx";

import { Link } from "react-router-dom";

import { HiOutlineArrowLeft } from "react-icons/hi2";

const Header = ({ hasReturn = false }) => {

    return (
        <header className="flex items-center justify-start gap-xl border-b border-primary/15 px-md py-xl sm:px-3xl">
            {hasReturn && (
                <Link to="/" aria-label="Return to search page" className="flex items-center justify-center">
                    <HiOutlineArrowLeft className="h-xl w-xl cursor-pointer text-primary/60 transition-colors duration-100 ease-in-out hover:text-primary" />
                </Link>
            )}

            <Logo />
        </header>
    )
}

export default Header;
