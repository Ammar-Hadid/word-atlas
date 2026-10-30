import 'dotenv/config';
import express from 'express';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFile,statfs } from 'node:fs/promises';
import { query, pool } from './db/index.js';
import { privateResponse, sessionMiddleware, csrfProtection, requireAuth } from './auth/session.js';
import authRouter from './routes/authRoutes.js';
import libraryRouter from './routes/libraryRoutes.js';
import insightRouter from './routes/insightRoutes.js';
import wordRouter from './routes/wordRoutes.js';
import { createAudioRouter } from './routes/audioRoutes.js';
import { getEntry, suggestions } from './repositories/entries.js';
import { validTerm } from './import/normalizeKaikki.js';
import { getEditorial } from './services/editorialService.js';

export function createApp() {
    const app=express();
    app.disable('x-powered-by');
    app.set('trust proxy',1); // Backend port is private; exactly one Caddy hop.
    app.use((_req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});next();});
    app.get('/api/health',(_req,res)=>res.json({status:'ok'}));
    app.get('/api/ready',async(_req,res)=>{
        const {rows}=await query("SELECT active_release_id FROM sources WHERE id='wiktionary-en'");
        res.status(rows[0]?.active_release_id?200:503).json({status:rows[0]?.active_release_id?'ready':'dictionary_pending',releaseId:rows[0]?.active_release_id||null});
    });
    app.use('/audio', (req,res,next)=>{
        if(!/^\/[a-f0-9]{64}\.mp3$/.test(req.path)) return res.sendStatus(404);
        next();
    },express.static(resolve(process.env.AUDIO_DIR||'./data/audio'),{immutable:true,maxAge:'1y',fallthrough:false,dotfiles:'deny'}));
    app.use('/api',express.json({limit:'512kb',inflate:false}));
    app.use('/api/words',(req,res,next)=>{
        if(req.get('Origin')===process.env.APP_ORIGIN){res.set('Access-Control-Allow-Origin',process.env.APP_ORIGIN);res.vary('Origin');}
        next();
    },wordRouter);
    app.use('/api/insights',insightRouter);
    app.get('/api/suggestions',async(req,res)=>{
        if(!validTerm(req.query.term)) return res.status(400).json({error:'Invalid term.'});
        res.set('Cache-Control','public,max-age=60').json({suggestions:await suggestions(req.query.term)});
    });
    app.get('/api/entries/:id/enrichment',async(req,res)=>{
        const entry=await getEntry(req.params.id);
        if(!entry) return res.status(404).json({error:'Entry not found.'});
        res.set('Cache-Control','no-store').json(await getEditorial(entry.word));
    });
    app.use('/api',sessionMiddleware());
    app.use('/api',privateResponse,csrfProtection);
    app.use('/api/auth',authRouter);
    app.use('/api/me',libraryRouter);
    app.use('/api/pronunciations',createAudioRouter({requireAuth}));
    app.get('/api/status',requireAuth,async(req,res)=>{
        const [release,usage]=await Promise.all([
            query("SELECT r.id,r.counts,r.completed_at FROM dictionary_releases r JOIN sources s ON s.active_release_id=r.id"),
            query('SELECT provider,period_start,period_end,character_limit,verified_until,reserved_characters FROM provider_allowances ORDER BY period_start DESC LIMIT 1').catch(()=>({rows:[]})),
        ]);
        const storage=await statfs(resolve(process.env.AUDIO_DIR||'./data/audio')).catch(()=>null);
        const lastBackup=await readFile('/data/backups/latest-success','utf8').catch(()=>null);
        res.json({release:release.rows[0],synthesisEnabled:process.env.AUDIO_SYNTHESIS_ENABLED==='true',allowance:usage.rows[0]||null,freeDiskBytes:storage?storage.bavail*storage.bsize:null,lastBackup:lastBackup?.trim()||null});
    });
    app.use('/api',(_req,res)=>res.status(404).json({error:'Endpoint not found.'}));
    app.use((error,_req,res,_next)=>{
        void _next;
        const status=error.status>=400&&error.status<500?error.status:503;
        if(status>=500) console.error('Request failed',{code:error.code||'internal',message:error.message});
        res.status(status).json({error:status<500?error.message:'The dictionary service is temporarily unavailable. Please retry.'});
    });
    return app;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
    const server=createApp().listen(Number(process.env.PORT||4000),()=>console.log('Word Atlas listening'));
    process.on('SIGTERM',()=>server.close(()=>pool.end().then(()=>process.exit(0))));
}
