import { Volume2 } from "lucide-react";


const AudioButton = ({ word, audio }) => {
    if (!audio) return null;

    const handleAudio = () => {
        const pronunciationAudio = new Audio(audio);

        pronunciationAudio.play();
    }

    return (
        <button
            type="button"
            onClick={handleAudio}
            aria-label={word ? `Play pronunciation for ${word}` : "Play pronunciation"}
            className="group p-base bg-card  rounded-full cursor-pointer transition-colors duration-200 ease-in-out hover:bg-primary"
        >

            <Volume2 className="w-lg h-lg text-primary transition-colors duration-200 ease-in-out group-hover:text-secondary" />
        </button>
    )
}

export default AudioButton;