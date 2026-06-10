const Pill = ({ children, type = "default", className = '' }) => {
    if (!children) return null;

    const variants = {
        default: "text-primary bg-card",
        danger: "border border-danger text-danger bg-transparent",
    };

    const variantClass = variants[type] ?? variants.default;

    const baseClass =
        `${variantClass} inline-flex items-center rounded-full px-md py-xs text-body`;

    return (
        <span className={`${baseClass} ${className}`}>
            {children}
        </span >
    );
};

export default Pill;