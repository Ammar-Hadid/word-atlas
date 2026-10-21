const IconButton = ({ label, children, className = "", active = false, ...props }) => {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-colors duration-200 ${active
                ? "border-ink bg-ink text-paper"
                : "border-line bg-surface text-ink hover:border-line-strong hover:bg-sunken"
                } ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};

export default IconButton;
