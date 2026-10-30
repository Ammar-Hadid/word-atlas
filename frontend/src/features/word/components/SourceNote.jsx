const SourceNote = ({ source }) => {
    if (!source) return null;
    return (
        <div className="flex flex-col gap-xs text-body-sm text-muted">
            <p>
                <a href={source.url} target="_blank" rel="noreferrer" className="underline decoration-line-strong underline-offset-4 hover:text-ink">{source.name}</a>
                {source.license && <> · <a href={source.licenseUrl} target="_blank" rel="noreferrer" className="underline decoration-line-strong underline-offset-4 hover:text-ink">{source.license}</a></>}
            </p>
            {(source.attribution || source.releaseId) && (
                <details>
                    <summary className="w-fit cursor-pointer text-[0.75rem] hover:text-ink">Attribution & release</summary>
                    <div className="mt-xs flex flex-col gap-xs text-[0.75rem]">
                        {source.attribution && <p>{source.attribution}</p>}
                        {source.modifications && <p>{source.modifications}</p>}
                        {source.releaseId && <p className="break-all">Release: {source.releaseId}</p>}
                    </div>
                </details>
            )}
        </div>
    );
};
export default SourceNote;
