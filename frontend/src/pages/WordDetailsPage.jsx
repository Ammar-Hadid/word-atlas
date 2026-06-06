import WordSummary from "../features/word/components/WordSummary.jsx";
import MeaningsSection from "../features/word/components/MeaningsSection.jsx";
import OriginSection from "../features/word/components/OriginSection.jsx";

const WordDetailsPage = ({ setHasReturn }) => {
    return (
        <div className="font-body">
            <WordSummary
                word={wordDetails.word}
                phonetic={wordDetails.phonetic}
                audio={wordDetails.audio}
                partsOfSpeech={wordDetails.partsOfSpeech}
            />

            <MeaningsSection meanings={wordDetails.meanings} />
            <OriginSection origin={wordDetails.origin} />
        </div>
    );
};

export default WordDetailsPage;
