const LogoMark = ({ className = "" }) => {
    return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
            <rect width="64" height="64" rx="14" className="fill-ink" />
            <path
                d="M32 9 L36.2 27.8 L55 32 L36.2 36.2 L32 55 L27.8 36.2 L9 32 L27.8 27.8 Z"
                className="fill-paper"
            />
            <circle cx="32" cy="32" r="3.2" className="fill-accent" />
        </svg>
    );
};

export default LogoMark;
