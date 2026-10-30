import { useCallback, useEffect, useRef, useState } from "react";
import { getPronunciationAudio, preparePronunciationAudio } from "../api/pronunciationApi.js";

const POLL_MS = 1000;
const MAX_POLLS = 30;
const AUDIO_URL = /^\/audio\/[a-f0-9]{64}\.mp3$/;

// Loads the Iapetus recording for one pronunciation, asking the server to record
// it the first time, and keeps an Audio element ready so playback starts at once.
// The server pauses new recordings near the free allowance; then this reports
// "unavailable" and the button falls back to other sources.
export function usePronunciation(pronunciation) {
    const id = pronunciation?.id;
    const cachedUrl = pronunciation?.status === "ready" ? pronunciation.url : null;
    const [state, setState] = useState({ id: null, status: "idle" });
    const [isPlaying, setIsPlaying] = useState(false);
    const [revision, setRevision] = useState(0);
    const audioRef = useRef(null);

    useEffect(() => {
        if (!id) return;

        const controller = new AbortController();
        const { signal } = controller;
        const audio = new Audio();
        audio.preload = "auto";
        audioRef.current = audio;

        const update = status => { if (!signal.aborted) setState({ id, status }); };
        const stop = () => { if (!signal.aborted) setIsPlaying(false); };
        audio.onplaying = () => { if (!signal.aborted) setIsPlaying(true); };
        audio.onended = stop;
        audio.onpause = stop;
        audio.onerror = () => { stop(); update("failed"); };

        const wait = () => new Promise(resolve => {
            const timer = setTimeout(resolve, POLL_MS);
            signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
        });

        const load = async () => {
            update("loading");
            try {
                let result = cachedUrl ? { status: "ready", url: cachedUrl } : await getPronunciationAudio(id, signal);
                if (result.status === "unprepared") result = await preparePronunciationAudio(id, signal);
                for (let polls = 0; result.status === "pending" && polls < MAX_POLLS; polls++) {
                    await wait();
                    if (signal.aborted) return;
                    result = await getPronunciationAudio(id, signal);
                }
                if (signal.aborted) return;

                if (result.status === "ready" && AUDIO_URL.test(result.url)) {
                    audio.src = result.url;
                    audio.load();
                    update("ready");
                } else {
                    update(result.status === "pending" ? "failed" : "unavailable");
                }
            }
            catch (error) {
                if (error.name !== "AbortError") update("failed");
            }
        };

        void load();

        return () => {
            controller.abort();
            audio.pause();
            audio.onplaying = audio.onended = audio.onpause = audio.onerror = null;
            audio.removeAttribute("src");
            audio.load();
            audioRef.current = null;
        };
    }, [id, cachedUrl, revision]);

    const play = useCallback(() => {
        const audio = audioRef.current;
        if (!audio?.src) return;
        audio.currentTime = 0;
        audio.play().catch(() => setIsPlaying(false));
    }, []);

    const retry = useCallback(() => setRevision(value => value + 1), []);

    const status = !id ? "idle" : state.id === id ? state.status : "loading";

    return { status, isPlaying: isPlaying && status === "ready", play, retry };
}
