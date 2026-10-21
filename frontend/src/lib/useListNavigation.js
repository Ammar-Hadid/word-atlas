import { useState } from "react";

// Shared keyboard handling for listbox-style menus (search, command palette).
export const useListNavigation = (itemCount, onSelect) => {
    const [activeIndex, setActiveIndex] = useState(-1);

    const clampedIndex = activeIndex >= itemCount ? itemCount - 1 : activeIndex;

    const onKeyDown = (event) => {
        if (!itemCount) return;

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex(index => (index + 1) % itemCount);
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex(index => (index <= 0 ? itemCount - 1 : index - 1));
        }

        if (event.key === "Enter" && clampedIndex >= 0) {
            event.preventDefault();
            onSelect(clampedIndex);
        }
    };

    return { activeIndex: clampedIndex, setActiveIndex, onKeyDown };
};
