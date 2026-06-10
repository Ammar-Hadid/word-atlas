const getDefinitionPreview = (entry, limit = 2) => {
    if (!entry?.senses?.length) return [];

    const quickMeanings = entry.senses
        .slice(0, limit)
        .map(group => {
            const sense = group?.senses?.[0];

            return {
                id: sense?.id,
                definition: sense?.definition,
                example: sense?.examples?.[0] ?? null
            }
        })
        .filter(item => item.definition) ?? [];


    return quickMeanings
}

export default getDefinitionPreview;

