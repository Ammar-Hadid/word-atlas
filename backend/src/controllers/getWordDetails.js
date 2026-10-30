import { lookupTerm } from '../repositories/entries.js';
import { validTerm } from '../import/normalizeKaikki.js';
import { getEditorial } from '../services/editorialService.js';
import { ensureEntryPronunciations } from '../services/pronunciationService.js';

export function createWordDetailsController({ lookup=lookupTerm, pronunciations=ensureEntryPronunciations, editorialSource=getEditorial }={}) {
    return async function getWordDetails(req,res) {
        const term=req.query.term;
        if(!validTerm(term)) return res.status(400).json({error:'Enter a term of 1–200 characters.'});
        const local=await lookup(term);
        if(local.word.length) {
            for(const entry of local.word) {
                try { entry.pronunciations=await pronunciations(entry); }
                catch {
                    // Audio metadata is optional. Its failure must not hide valid source meanings.
                    entry.pronunciations=[];
                    entry.audioAvailability='unavailable';
                }
            }
            res.set('Cache-Control','no-cache');
            return res.json(local);
        }
        if(req.query.localOnly==='1') return res.status(404).json({error:'Word not found in the local dictionary.',suggestions:local.suggestions});
        const editorial=await editorialSource(term);
        res.set('Cache-Control','no-store');
        if(editorial.word.length) return res.json({...editorial,matchType:'editorial',releaseId:local.releaseId});
        const unavailable=Object.values(editorial.availability).some(value=>!['available','not_found'].includes(typeof value==='string'?value:value?.status));
        return res.status(404).json({error:'Word not found in the local dictionary.',suggestions:local.suggestions,providerAvailability:editorial.availability,editorialUnavailable:unavailable});
    };
}
export const getWordDetails=createWordDetailsController();
