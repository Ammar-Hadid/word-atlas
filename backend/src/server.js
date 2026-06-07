import express from "express";
import 'dotenv';

import wordRouter from "./routes/wordRoutes.js";

const app = express();

const PORT = process.env.MERRIAM_WEBSTER_LEARNING || 4000

app.listen(PORT, () => {
    console.log('Server is running')
})

app.use(express.json());
app.use('/api/word:word', wordRouter);