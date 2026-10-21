const WordPageSkeleton = () => {
    return (
        <div aria-busy="true" aria-label="Loading entry">
            <section className="border-b border-line">
                <div className="container-page flex flex-col gap-xl pb-xl pt-2xl sm:pt-3xl">
                    <span className="skeleton h-3 w-40" />
                    <div className="flex flex-col gap-lg">
                        <span className="skeleton h-[clamp(3.25rem,11vw,9rem)] w-[min(36rem,80%)] rounded-2xl" />
                        <span className="skeleton h-4 w-64" />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex gap-md">
                            <span className="skeleton h-11 w-28 rounded-full" />
                            <span className="skeleton h-11 w-40 rounded-full" />
                        </div>
                        <div className="hidden gap-sm sm:flex">
                            {[0, 1, 2].map(item => <span key={item} className="skeleton h-10 w-10 rounded-full" />)}
                        </div>
                    </div>
                </div>
            </section>

            <div className="container-page grid gap-2xl py-2xl lg:grid-cols-12">
                <div className="flex flex-col gap-xl lg:col-span-8">
                    {[0, 1, 2].map(item => (
                        <div key={item} className="grid grid-cols-[3.5rem_1fr] gap-md">
                            <span className="skeleton h-6 w-8" />
                            <div className="flex flex-col gap-sm">
                                <span className="skeleton h-5 w-full" />
                                <span className="skeleton h-5 w-9/12" />
                                <span className="skeleton h-4 w-7/12" />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex flex-col gap-md lg:col-span-4">
                    <span className="skeleton h-56 w-full rounded-2xl" />
                    <span className="skeleton h-40 w-full rounded-2xl" />
                </div>
            </div>
        </div>
    );
};

export default WordPageSkeleton;
