import AudioButton from "./AudioButton.jsx";

const FormsList = ({ forms }) => {
    const items = forms?.filter(form => form.form) ?? [];

    if (!items.length) return null;

    return (
        <ul className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            {items.map((form, index) => (
                <li key={`${form.form}-${index}`} className="flex items-center justify-between gap-md rounded-xl border border-line bg-surface px-md py-base">
                    <div className="flex flex-col">
                        <span className="display text-h5">{form.form}</span>
                        <span className="text-body-sm text-muted">
                            {[form.label, form.phonetic && `/${form.phonetic}/`].filter(Boolean).join(" · ") || "inflection"}
                        </span>
                    </div>
                    {form.audio && <AudioButton word={form.form} audio={form.audio} size="sm" />}
                </li>
            ))}
        </ul>
    );
};

export default FormsList;
