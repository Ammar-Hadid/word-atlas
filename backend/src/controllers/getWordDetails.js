const getWordDetails = async (req, res) => {
    const { term } = req.query?.term.trim();

    if (!term) {
        return res.status(400).json({ error: 'Term is required.' })
    }

    try {
        
    }


}