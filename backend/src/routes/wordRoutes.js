import express from "express";

import { getWordDetails } from "../controllers/getWordDetails.js";

const router = express.Router();

router.get('/', getWordDetails)

export default router;