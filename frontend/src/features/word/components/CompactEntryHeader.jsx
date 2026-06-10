import AudioButton from "./AudioButton.jsx";

import Pill from "../../../components/ui/Pill.jsx";

const CompactEntryHeader = ({ word, audio, phonetic, partOfSpeech, isOffensive }) => {

    return (
        <div>

            <div className="flex items-center gap-lg tracking-widest">
                <div className="flex flex-col items-start justify-center">
                    <h1 className="font-body font-medium text-h5">{word}</h1>
                    {phonetic && <p className="text-primary-muted">{phonetic}</p>}
                </div>

                {partOfSpeech && <Pill>{partOfSpeech}</Pill>}

                <AudioButton audio={audio} word={word} />

                {isOffensive && <Pill type="danger">offensive</Pill>}
            </div>

        </div>
    )
}

export default CompactEntryHeader