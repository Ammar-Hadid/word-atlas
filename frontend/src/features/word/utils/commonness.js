const TIERS = [
    { min: 50, level: 5, label: "Essential", note: "Among the most-used words in English." },
    { min: 10, level: 4, label: "Very common", note: "Part of everyday vocabulary." },
    { min: 1, level: 3, label: "Common", note: "Familiar to most readers." },
    { min: 0.1, level: 2, label: "Uncommon", note: "Found more in writing than speech." },
    { min: 0, level: 1, label: "Rare", note: "A word for the well-read." },
];

export const getCommonness = (frequency) => {
    if (frequency === null || frequency === undefined) return null;
    return TIERS.find(tier => frequency >= tier.min);
};

export const formatFrequency = (frequency) => {
    if (frequency >= 10) return Math.round(frequency).toLocaleString();
    if (frequency >= 1) return frequency.toFixed(1);
    return frequency.toPrecision(2);
};
