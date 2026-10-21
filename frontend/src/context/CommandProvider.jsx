import { useCallback, useEffect, useMemo, useState } from "react";

import { CommandContext } from "./contexts.js";
import CommandPalette from "../components/command/CommandPalette.jsx";
import { isTypingTarget } from "../lib/platform.js";

const CommandProvider = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);

    const openPalette = useCallback(() => setIsOpen(true), []);
    const closePalette = useCallback(() => setIsOpen(false), []);

    useEffect(() => {
        const onKeyDown = (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setIsOpen(open => !open);
            }

            if (event.key === "/" && !isTypingTarget(event.target)) {
                event.preventDefault();
                setIsOpen(true);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    const value = useMemo(() => ({ isOpen, openPalette, closePalette }), [isOpen, openPalette, closePalette]);

    return (
        <CommandContext.Provider value={value}>
            {children}
            <CommandPalette isOpen={isOpen} onClose={closePalette} />
        </CommandContext.Provider>
    );
};

export default CommandProvider;
