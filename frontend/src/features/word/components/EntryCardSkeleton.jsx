const SkeletonBlock = ({ className = "" }) => {
    return (
        <div
            className={`animate-pulse rounded-md bg-linear-to-r from-card via-primary/10 to-card ${className}`}
        />
    );
};

const EntryCardSkeleton = () => {
    return (
        <div className="flex flex-col gap-lg rounded-md border border-primary/15 p-lg">
            <div className="flex items-center gap-lg">
                <SkeletonBlock className="h-10 w-40" />
                <SkeletonBlock className="h-10 w-10 rounded-full" />
            </div>

            <div className="flex items-center gap-md">
                <SkeletonBlock className="h-7 w-20 rounded-full" />
                <SkeletonBlock className="h-6 w-24" />
            </div>

            <div className="flex flex-col gap-md">
                <SkeletonBlock className="h-5 w-full" />
                <SkeletonBlock className="h-5 w-10/12" />
                <SkeletonBlock className="h-5 w-8/12" />
            </div>
        </div>
    );
};

export default EntryCardSkeleton;