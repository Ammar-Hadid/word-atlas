import { useEffect } from "react";

const BASE_TITLE = "Word Atlas";

export const useDocumentTitle = (title, enabled = true) => {
    useEffect(() => {
        if (!enabled) return;
        document.title = title ? `${title} — ${BASE_TITLE}` : `${BASE_TITLE} — Every word, mapped.`;
    }, [title, enabled]);
};
