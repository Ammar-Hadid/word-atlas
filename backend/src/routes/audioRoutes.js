import { Router } from 'express';
import { prepareAudio, readAudio } from '../repositories/audio.js';

const VISITOR_RECORDINGS_PER_HOUR = 60;

// Anyone can create recordings of dictionary entries (never arbitrary text), which
// grows the shared cache. Visitors are limited per IP and draw from a smaller share
// of the monthly allowance than the signed-in owner (see providerBudget.js).
export function createAudioRouter({ identifyUser, limitVisitor, database } = {}) {
    if (!identifyUser || !limitVisitor) throw new Error('Audio routes need user identification and visitor limits.');
    const router = Router();
    router.use((req,res,next) => { res.set('Cache-Control','private, no-store'); next(); });
    router.param('id',(req,res,next,id) => /^[a-f0-9]{64}$/.test(id)
        ? next() : res.status(400).json({error:'Invalid pronunciation ID.'}));
    router.get('/:id/audio',identifyUser,async (req,res) => {
        const result = await readAudio(req.params.id,database,{userId:req.user?.id});
        return result ? res.json(result) : res.status(404).json({error:'Pronunciation not found.'});
    });
    router.post('/:id/audio',identifyUser,async (req,res) => {
        if (!req.user && !await limitVisitor(req,VISITOR_RECORDINGS_PER_HOUR)) {
            return res.status(429).json({status:'unavailable',reason:'rate_limited',error:'Too many new recordings. Try again later.'});
        }
        const result = await prepareAudio(req.params.id,req.user?.id,database);
        return result ? res.status(result.status === 'pending' ? 202 : 200).json(result)
            : res.status(404).json({error:'Pronunciation not found.'});
    });
    return router;
}
export default createAudioRouter;
