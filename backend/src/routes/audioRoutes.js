import { Router } from 'express';
import { prepareAudio, readAudio } from '../repositories/audio.js';

export function createAudioRouter({ requireAuth, database } = {}) {
    if (!requireAuth) throw new Error('Audio generation requires authentication middleware.');
    const router = Router();
    router.use((req,res,next) => { res.set('Cache-Control','private, no-store'); next(); });
    router.param('id',(req,res,next,id) => /^[a-f0-9]{64}$/.test(id)
        ? next() : res.status(400).json({error:'Invalid pronunciation ID.'}));
    router.get('/:id/audio',async (req,res) => {
        const result = await readAudio(req.params.id,database);
        return result ? res.json(result) : res.status(404).json({error:'Pronunciation not found.'});
    });
    router.post('/:id/audio',requireAuth,async (req,res) => {
        const result = await prepareAudio(req.params.id,req.user.id,database);
        return result ? res.status(result.status === 'pending' ? 202 : 200).json(result)
            : res.status(404).json({error:'Pronunciation not found.'});
    });
    return router;
}
export default createAudioRouter;
