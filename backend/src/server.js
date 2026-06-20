import express from "express";
import 'dotenv/config';

import cors from "cors";

import wordRouter from "./routes/wordRoutes.js";

const app = express();

const PORT = process.env.PORT || 4000;

const allowedOrigins = (
    process.env.CLIENT_URL || 'https://word-atlas.ammarhadid.com,https://www.word-atlas.ammarhadid.com'
)
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin(requestedOrigin, callback) {
        if (!requestedOrigin || allowedOrigins.includes(requestedOrigin)) {
            return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'), false);
    }
}))

app.use(express.json());
app.use('/api/words', wordRouter);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})