const Pill = ({ children }) => {
    if (!children) return null;

    return (
        <span className="inline-flex items-center rounded-full bg-card px-md py-xs text-body text-primary">
            {children}
        </span>
    );
};

export default Pill;