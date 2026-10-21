const Kbd = ({ children, className = "" }) => {
    return (
        <kbd className={`inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line-strong bg-surface px-1 font-mono text-[0.6875rem] leading-none text-muted ${className}`}>
            {children}
        </kbd>
    );
};

export default Kbd;
