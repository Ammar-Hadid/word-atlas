const Pill = ({ children, type = "default" }) => {
    if (!children) return null;

    const variants = {
        default: 'text-primary bg-card',
        danger: 'border border-danger text-danger bg-transparent'
    }

    const variantClass = variants[type] ?? variants.default

    return (
        <span className={`${variantClass} inline-flex items-center rounded-full px-md py-xs  text-body`}>
            {children}
        </span>
    );
};

export default Pill;