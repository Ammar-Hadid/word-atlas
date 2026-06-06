const OriginSection = ({ origin }) => {
    if (!origin) return null;

    return (
        <section className="max-w-160 pb-3xl">
            <h2 className="mb-sm font-display text-h5 font-bold">Origin</h2>
            <p className="text-body leading-relaxed text-primary">
                {origin}
            </p>
        </section>
    );
};

export default OriginSection;