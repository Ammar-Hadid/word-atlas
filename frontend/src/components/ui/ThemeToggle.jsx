import { Monitor, Moon, Sun } from "lucide-react";

import { useTheme } from "../../context/contexts.js";

const ICONS = { system: Monitor, light: Sun, dark: Moon };
const LABELS = { system: "System theme", light: "Light theme", dark: "Dark theme" };

const ThemeToggle = () => {
    const { theme, cycleTheme } = useTheme();
    const Icon = ICONS[theme];

    return (
        <button
            type="button"
            onClick={cycleTheme}
            aria-label={`${LABELS[theme]} (click to change)`}
            title={LABELS[theme]}
            className="grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink"
        >
            <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.75} />
        </button>
    );
};

export default ThemeToggle;
