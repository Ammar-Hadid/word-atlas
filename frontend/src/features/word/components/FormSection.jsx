import PillList from "../../../components/ui/PillList.jsx"

const FormsSection = ({ forms }) => {
    if (!forms.length) return null;

    const formItems = forms
        .map(form => {
            return form?.form
        }).filter(Boolean);

    if (!formItems.length) return null

    return (
        <div className="flex flex-col gap-sm">
            <h4 className="text-body font-semibold">Forms</h4>
            <PillList items={formItems} />
        </div>
    )
}

export default FormsSection;