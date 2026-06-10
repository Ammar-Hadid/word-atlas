import AudioButton from "./AudioButton.jsx";

import Pill from "../../../components/ui/Pill.jsx";

const EntryHeader = ({ word, audio, phonetic, partOfSpeech, isOffensive }) => {

    return (
        <div>

            <div className="flex flex-col items-start gap-sm tracking-widest">
                {isOffensive && <Pill type="danger">offensive</Pill>}

                <div className="flex gap-lg items-center">
                    <h1 className="font-body font-extrabold text-h2">{word}</h1>

                    <AudioButton audio={audio} word={word} />
                </div>

                <div className="flex items-center gap-lg">
                    {partOfSpeech && <Pill>{partOfSpeech}</Pill>}
                    {phonetic && <p className="text-primary-muted">{phonetic}</p>}
                </div>
            </div>

        </div>
    )
}

export default EntryHeader