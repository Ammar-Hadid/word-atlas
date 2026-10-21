import { useEffect } from "react";
import { Bookmark, Copy, Share2 } from "lucide-react";

import IconButton from "../../../components/ui/IconButton.jsx";

import { useLibrary, useToast } from "../../../context/contexts.js";
import { isTypingTarget } from "../../../lib/platform.js";

const copyText = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    }

    catch {
        return false;
    }
};

const WordActions = ({ entry, definition }) => {
    const { isSaved, toggleSaved } = useLibrary();
    const notify = useToast();

    const saved = isSaved(entry.word);

    const handleSave = () => {
        const nowSaved = toggleSaved({
            word: entry.word,
            partOfSpeech: entry.partOfSpeech,
            phonetic: entry.phonetic,
            definition,
        });

        notify(nowSaved ? `Saved “${entry.word}” to your library` : "Removed from your library");
    };

    const handleCopy = async () => {
        const parts = [
            entry.word,
            entry.partOfSpeech && `(${entry.partOfSpeech})`,
            entry.phonetic && `/${entry.phonetic}/`,
        ].filter(Boolean).join(" ");

        if (await copyText(`${parts}\n${definition ?? ""}`.trim())) {
            notify("Definition copied");
        }
    };

    const handleShare = async () => {
        const shareData = { title: `${entry.word} — Word Atlas`, text: definition ?? entry.word, url: window.location.href };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
                return;
            }

            catch (error) {
                if (error.name === "AbortError") return;
            }
        }

        if (await copyText(window.location.href)) notify("Link copied");
    };

    // Re-bound every render so the "S" shortcut always sees fresh state.
    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key.toLowerCase() !== "s" || event.metaKey || event.ctrlKey || isTypingTarget(event.target)) return;
            handleSave();
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    });

    return (
        <div className="flex items-center gap-sm">
            <IconButton label={saved ? "Remove from library (S)" : "Save to library (S)"} active={saved} onClick={handleSave}>
                <Bookmark className="h-4 w-4" strokeWidth={1.75} fill={saved ? "currentColor" : "none"} />
            </IconButton>
            <IconButton label="Copy definition" onClick={handleCopy}>
                <Copy className="h-4 w-4" strokeWidth={1.75} />
            </IconButton>
            <IconButton label="Share" onClick={handleShare}>
                <Share2 className="h-4 w-4" strokeWidth={1.75} />
            </IconButton>
        </div>
    );
};

export default WordActions;
