import Logo from "../ui/Logo.jsx";

import { HiOutlineArrowLeft } from "react-icons/hi2";

const Header = ({ hasReturn = false }) => {

    return (
        <header className="flex items-center justify-start gap-xl border-b border-primary/15 px-md py-xl sm:px-3xl">
            {hasReturn && (
                <button className="flex items-center justify-center">
                    <HiOutlineArrowLeft className="text-primary/60 w-xl h-xl cursor-pointer transition-colors duration-100 ease-in-out hover:text-primary" />
                </button>
            )}

            <Logo />
        </header>
    )
}

export default Header;
