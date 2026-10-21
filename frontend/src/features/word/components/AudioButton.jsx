import { useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";

import { isTypingTarget } from "../../../lib/platform.js";

const speak = (word, { onEnd }) => {
    if (!("speechSynthesis" in window)) return false;

    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    utterance.onend = onEnd;
    utterance.onerror = onEnd;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);

    return true;
};

const Equalizer = () => (
    <span className="flex h-4 items-center gap-[2px]" aria-hidden="true">
        {[0, 1, 2, 3].map(bar => (
            <span
                key={bar}
                className="h-full w-[2.5px] origin-center rounded-full bg-current"
                style={{ animation: `equalize 0.9s ease-in-out ${bar * 0.12}s infinite` }}
            />
        ))}
    </span>
);

// Plays Merriam-Webster audio, falling back to the browser's speech engine
// for words without a recording.
const AudioButton = ({ word, audio, size = "md", shortcutKey }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef(null);
    const playRef = useRef(null);

    const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

    useEffect(() => () => {
        audioRef.current?.pause();
        if (canSpeak) window.speechSynthesis.cancel();
    }, [canSpeak]);

    useEffect(() => {
        if (!shortcutKey) return;

        const onKeyDown = (event) => {
            if (event.key.toLowerCase() !== shortcutKey || event.metaKey || event.ctrlKey || isTypingTarget(event.target)) return;
            playRef.current?.();
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [shortcutKey]);

    const play = () => {
        const stop = () => setIsPlaying(false);
        setIsPlaying(true);

        if (audio) {
            audioRef.current?.pause();
            audioRef.current = new Audio(audio);
            audioRef.current.onended = stop;
            audioRef.current.play().catch(() => {
                if (!speak(word, { onEnd: stop })) stop();
            });
            return;
        }

        speak(word, { onEnd: stop });
    };

    useEffect(() => {
        playRef.current = play;
    });

    if (!audio && !canSpeak) return null;

    const label = `Play pronunciation of ${word}${audio ? "" : " (synthesised)"}`;

    if (size === "sm") {
        return (
            <button
                type="button"
                onClick={play}
                aria-label={label}
                title={label}
                className="grid h-7 w-7 place-items-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-accent"
            >
                {isPlaying ? <Equalizer /> : <Volume2 className="h-3.5 w-3.5" strokeWidth={2} />}
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={play}
            aria-label={label}
            title={label}
            className={`group flex h-11 items-center gap-sm rounded-full pl-base pr-md text-body-sm font-medium transition-all duration-300 ${isPlaying
                ? "bg-accent text-accent-ink"
                : "bg-ink text-paper hover:bg-accent hover:text-accent-ink"
                }`}
        >
            <span className="grid h-6 w-6 place-items-center">
                {isPlaying ? <Equalizer /> : <Volume2 className="h-4 w-4" strokeWidth={2} />}
            </span>
            Listen
        </button>
    );
};

export default AudioButton;
