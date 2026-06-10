import getDefinitionPreview from "../utils/getDefinitionPreview.js";

const DefinitionPreview = ({ entry }) => {
    const DefinitionPreviewArr = getDefinitionPreview(entry);

    if (DefinitionPreviewArr.length === 0) return null;

    return (
        <div>
            <ul className="text-body pl-md flex flex-col gap-md">
                {DefinitionPreviewArr?.length > 0 && (
                    DefinitionPreviewArr.map((sense, index) => {
                        return (
                            <li key={sense?.id} className="flex justify-start gap-md">
                                <span className="font-bold">{index + 1}.</span>
                                <div className="flex flex-col">
                                    <span>{sense.definition}</span>
                                    {sense.example && <span className="text-primary-muted text-body-sm">"{sense.example}"</span>}
                                </div>
                            </li>
                        )
                    })
                )}
            </ul>
        </div>
    )
}

export default DefinitionPreview;