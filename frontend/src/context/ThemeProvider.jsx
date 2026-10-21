import { useEffect, useState } from "react";

import { ThemeContext } from "./contexts.js";

const STORAGE_KEY = "wa:theme";

const readTheme = () => {
    try {
        return localStorage.getItem(STORAGE_KEY) || "system";
    }

    catch {
        return "system";
    }
};

const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(readTheme);

    useEffect(() => {
        const media = matchMedia("(prefers-color-scheme: dark)");

        const apply = () => {
            const isDark = theme === "dark" || (theme === "system" && media.matches);
            document.documentElement.classList.toggle("dark", isDark);
        };

        apply();

        try {
            localStorage.setItem(STORAGE_KEY, theme);
        }

        catch {
            // Ignore: the theme just won't persist.
        }

        media.addEventListener("change", apply);
        return () => media.removeEventListener("change", apply);
    }, [theme]);

    const cycleTheme = () => {
        setTheme(current => ({ system: "light", light: "dark", dark: "system" })[current]);
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, cycleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export default ThemeProvider;
