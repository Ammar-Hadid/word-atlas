import { Router } from 'express';
import { getInsights } from '../services/datamuseService.js';

const router = Router();
router.get('/', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await getInsights(req.query.term));
});
export default router;
