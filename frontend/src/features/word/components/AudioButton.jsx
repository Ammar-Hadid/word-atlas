import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Volume2 } from "lucide-react";

import { usePronunciation } from "../hooks/usePronunciation.js";

import { isTypingTarget } from "../../../lib/platform.js";

const ACCENTS = [
    { value: "us", label: "US", name: "American English", lang: "en-US" },
    { value: "uk", label: "UK", name: "British English", lang: "en-GB" },
];

const speak = (word, lang, { onEnd }) => {
    if (!("speechSynthesis" in window)) return false;

    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = lang;
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

// Plays the Iapetus recording for the chosen accent. Words without one (including
// while new recordings are paused) fall back to Merriam-Webster, then the browser's voice.
const AudioButton = ({ word, pronunciations = [], fallbackAudio, accent, onAccentChange, shortcutKey }) => {
    const byAccent = Object.fromEntries(pronunciations.filter(item => item.accent).map(item => [item.accent, item]));
    const hasAccents = Boolean(byAccent.us && byAccent.uk);
    const active = ACCENTS.find(item => item.value === accent && byAccent[item.value]) ?? ACCENTS[0];
    const selected = byAccent[active.value]?.status === "unavailable" ? null : byAccent[active.value];

    const recording = usePronunciation(selected);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const fallbackRef = useRef(null);
    const playRef = useRef(null);

    const isPreparing = Boolean(selected) && ["loading", "pending"].includes(recording.status);
    const isPlaying = recording.isPlaying || isSpeaking;

    useEffect(() => () => {
        fallbackRef.current?.pause();
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    }, []);

    const play = () => {
        if (isPreparing) return;

        if (selected && recording.status === "ready") {
            recording.play();
            return;
        }

        // A failed recording is retried quietly in the background for next time.
        if (selected && recording.status === "failed") recording.retry();

        const stop = () => setIsSpeaking(false);
        setIsSpeaking(true);

        if (fallbackAudio && active.value === "us") {
            fallbackRef.current?.pause();
            fallbackRef.current = new Audio(fallbackAudio);
            fallbackRef.current.onended = stop;
            fallbackRef.current.play().catch(() => {
                if (!speak(word, active.lang, { onEnd: stop })) stop();
            });
            return;
        }

        if (!speak(word, active.lang, { onEnd: stop })) stop();
    };

    useEffect(() => {
        playRef.current = play;
    });

    useEffect(() => {
        if (!shortcutKey) return;

        const onKeyDown = (event) => {
            if (event.key.toLowerCase() !== shortcutKey || event.metaKey || event.ctrlKey || event.repeat || isTypingTarget(event.target)) return;
            playRef.current?.();
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [shortcutKey]);

    const label = isPreparing ? `Preparing ${active.name} pronunciation of ${word}` : `Play ${active.name} pronunciation of ${word}`;

    return (
        <div className="flex items-center gap-sm">
            <button
                type="button"
                onClick={play}
                aria-label={label}
                title={label}
                aria-busy={isPreparing || undefined}
                className={`group flex h-11 items-center gap-sm rounded-full pl-base pr-md text-body-sm font-medium transition-all duration-300 ${isPlaying
                    ? "bg-accent text-accent-ink"
                    : "bg-ink text-paper hover:bg-accent hover:text-accent-ink"
                    }`}
            >
                <span className="grid h-6 w-6 place-items-center">
                    {isPlaying ? <Equalizer /> : isPreparing ? <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Volume2 className="h-4 w-4" strokeWidth={2} />}
                </span>
                Listen
            </button>

            {hasAccents && (
                <div role="radiogroup" aria-label="Accent" className="flex rounded-full border border-line bg-surface p-[3px]">
                    {ACCENTS.map(item => {
                        const isActive = item.value === active.value;

                        return (
                            <button
                                key={item.value}
                                type="button"
                                role="radio"
                                aria-checked={isActive}
                                title={item.name}
                                onClick={() => onAccentChange(item.value)}
                                className={`rounded-full px-sm py-[0.3rem] font-mono text-[0.7rem] font-medium tracking-wider transition-colors ${isActive ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}
                            >
                                {item.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AudioButton;
