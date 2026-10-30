import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Volume2 } from "lucide-react";

import { useLibrary } from "../../../context/contexts.js";
import { audioStateLabel, usePronunciation } from "../hooks/usePronunciation.js";

import { isTypingTarget } from "../../../lib/platform.js";

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

// One selected, server-owned pronunciation uses the persisted Iapetus recording.
const AudioButton = ({ word, pronunciations = [], size = "md", shortcutKey }) => {
    const candidates = pronunciations.filter(item => /^[a-f0-9]{64}$/.test(item.id ?? ""));
    const available = candidates.filter(item => item.status !== "unavailable");
    const uniqueSounds = new Set(available.map(item => item.assetKey ?? item.id));
    const preferred = available.find(item => /\bUS\b|General[ -]American/i.test(item.label ?? "")) ?? available[0];
    const [chosen, setChosen] = useState(uniqueSounds.size === 1 ? preferred.id : "");
    const selected = candidates.find(item => item.id === chosen);
    const { user } = useLibrary();
    const playback = usePronunciation(selected, Boolean(user));
    const playRef = useRef(null);
    const canPlay = selected && playback.status === "ready";
    const canRetry = selected && ["failed", "pending"].includes(playback.status);
    const play = canPlay ? playback.play : canRetry ? playback.retry : () => {};

    useEffect(() => { playRef.current = play; });
    useEffect(() => {
        if (!shortcutKey) return;
        const onKeyDown = (event) => {
            if (event.key.toLowerCase() !== shortcutKey || event.metaKey || event.ctrlKey || event.repeat || isTypingTarget(event.target)) return;
            playRef.current?.();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [shortcutKey]);

    // A persisted asset can still be downloading. Keep the user gesture usable
    // (some mobile browsers defer preload), while reporting that it is loading.
    const buffering = canPlay && !playback.loaded;
    const pending = selected && (["loading", "pending"].includes(playback.status) || buffering);
    const text = !selected && candidates.length > 1 ? "Choose sound"
        : !selected ? "Audio unavailable"
            : playback.status === "pending" ? "Preparing"
                : playback.status === "loading" || buffering ? "Loading"
                    : playback.status === "failed" ? "Try audio again"
                        : audioStateLabel[playback.status] ?? "Listen";
    const label = canPlay ? `Play Iapetus pronunciation of ${word}`
        : playback.description ?? text;
    const button = (
        <button
            type="button"
            onClick={play}
            disabled={!canPlay && !canRetry}
            aria-label={label}
            title={label}
            aria-busy={pending || undefined}
            className={size === "sm"
                ? "grid h-7 w-7 place-items-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-accent disabled:opacity-50"
                : `group flex h-11 items-center gap-sm rounded-full pl-base pr-md text-body-sm font-medium transition-all duration-300 disabled:cursor-default disabled:opacity-60 ${playback.isPlaying
                    ? "bg-accent text-accent-ink"
                    : "bg-ink text-paper hover:bg-accent hover:text-accent-ink"}`}
        >
            <span className={size === "sm" ? "grid place-items-center" : "grid h-6 w-6 place-items-center"}>
                {playback.isPlaying ? <Equalizer /> : pending ? <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Volume2 className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2} />}
            </span>
            {size !== "sm" && <span aria-live="polite">{text}</span>}
        </button>
    );
    if (candidates.length <= 1) return button;
    return (
        <div className="flex flex-wrap items-center gap-sm">
            {button}
            <select
                aria-label={`Pronunciation of ${word}`}
                value={chosen}
                onChange={event => setChosen(event.target.value)}
                className="h-10 max-w-[18rem] rounded-full border border-line bg-surface px-md font-mono text-body-sm text-muted focus:border-ink focus:outline-none"
            >
                <option value="">Choose a pronunciation</option>
                {candidates.map(item => <option key={item.id} value={item.id} disabled={item.status === "unavailable"}>{item.label ?? item.ipa ?? "US English"}</option>)}
            </select>
        </div>
    );
};

export default AudioButton;
