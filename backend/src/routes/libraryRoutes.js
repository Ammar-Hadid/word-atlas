import { Router } from 'express';
import { requireAuth } from '../auth/session.js';
import { listItems, saveItem, removeItem, clearHistory, importItems, getSavedItem } from '../repositories/library.js';
const router=Router();
router.use(requireAuth);
const page=req=>{
    const offset=Number(req.query.offset||0),limit=Number(req.query.limit||100);
    if(!Number.isSafeInteger(offset)||offset<0||offset>10000000||!Number.isSafeInteger(limit)||limit<1||limit>200) throw Object.assign(new Error('Invalid page.'),{status:400});
    return {offset,limit};
};
router.get('/library',async(req,res)=>res.json(await listItems(req.user.id,'saved',page(req))));
router.get('/library/:id',async(req,res)=>res.json({item:await getSavedItem(req.user.id,req.params.id)}));
router.get('/history',async(req,res)=>res.json(await listItems(req.user.id,'history',page(req))));
router.put('/library/:id',async(req,res)=>{
    if(req.params.id!==req.body?.word) return res.status(400).json({error:'Word does not match route.'});
    await saveItem(req.user.id,req.body,'saved',req.get('Idempotency-Key'));res.json({ok:true});
});
router.delete('/library/:id',async(req,res)=>{await removeItem(req.user.id,req.params.id,req.get('Idempotency-Key'));res.json({ok:true});});
router.post('/history',async(req,res)=>{await saveItem(req.user.id,req.body,'history',req.get('Idempotency-Key'));res.json({ok:true});});
router.delete('/history',async(req,res)=>{await clearHistory(req.user.id,req.get('Idempotency-Key'));res.json({ok:true});});
router.post('/import',async(req,res)=>res.json(await importItems(req.user.id,req.body)));
router.get('/export',async(req,res)=>{
    const saved=[],history=[];
    for(const [type,target] of [['saved',saved],['history',history]]) {
        let offset=0;
        do { const p=await listItems(req.user.id,type,{offset,limit:200});target.push(...p.items);offset=p.nextOffset; } while(offset!==null);
    }
    res.set('Content-Disposition','attachment; filename="word-atlas-library.json"').json({saved,history,exportedAt:new Date().toISOString()});
});
export default router;
