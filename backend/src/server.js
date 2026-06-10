import express from "express";
import 'dotenv/config';

import cors from "cors";

import wordRouter from "./routes/wordRoutes.js";

const app = express();

const PORT = process.env.PORT || 4000
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(cors({
    origin: CLIENT_URL,
}))

app.use(express.json());
app.use('/api/words', wordRouter);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})