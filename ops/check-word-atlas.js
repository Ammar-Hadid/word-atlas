// Read-only acceptance probe. Never calls enrichment, insights, or audio preparation.
// Run inside the backend container to measure VPS service time without CDN challenges.
import { parseArgs } from 'node:util';
import { performance } from 'node:perf_hooks';
const { values } = parseArgs({ options: {
    base: { type: 'string', default: 'http://127.0.0.1:4000' },
    seconds: { type: 'string', default: '60' },
    rps: { type: 'string', default: '3' },
} });
const seconds = Number(values.seconds), rps = Number(values.rps);
if (!Number.isInteger(seconds) || seconds < 1 || seconds > 120 || ![2,3,4,5].includes(rps)) {
    throw new Error('Use 1–120 seconds and 2–5 requests per second.');
}
const base = new URL(values.base);
const terms = ['serendipity','petrichor','sesquipedalian','lead','read','colour','children',
    'went','ran','US','us','kick the bucket','break the ice','look up','take off','rain cats and dogs'];
const groups = { lookup: [], suggestions: [], cachedAudio: [] };
const errors = [], startedAt = new Date().toISOString();
const ready = await fetch(new URL('/api/ready', base)).then(r => r.json());
if (ready.status !== 'ready') throw new Error('Dictionary is not ready.');
const clip = '/audio/71450a2b7ec3728978224c0b2b7812689d1a13f387f406993f1ed79e9c95125c.mp3';
const probe = async index => {
    const group = index % 10 === 8 ? 'suggestions' : index % 10 === 9 ? 'cachedAudio' : 'lookup';
    const term = terms[index % terms.length];
    const path = group === 'cachedAudio' ? clip : group === 'suggestions'
        ? `/api/suggestions?term=${encodeURIComponent(term.slice(0,3))}`
        : `/api/words?localOnly=1&term=${encodeURIComponent(term)}`;
    const start = performance.now();
    try {
        const response = await fetch(new URL(path,base), { signal: AbortSignal.timeout(10000) });
        const bytes = await response.arrayBuffer();
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (group === 'lookup' && !JSON.parse(Buffer.from(bytes)).word?.length) throw new Error('Missing expected term');
        groups[group].push(performance.now()-start);
    } catch (error) { errors.push({ group,term,error:error.message }); }
};
const started = performance.now(), pending = [];
for (let index=0; index<seconds*rps; index++) {
    const delay = started + index*1000/rps - performance.now();
    if (delay>0) await new Promise(resolve => setTimeout(resolve,delay));
    pending.push(probe(index));
}
await Promise.all(pending);
const summary = Object.fromEntries(Object.entries(groups).map(([key,latencies]) => {
    latencies.sort((a,b)=>a-b);
    const percentile = p => Math.round((latencies[Math.min(latencies.length-1,Math.floor(latencies.length*p))]||0)*10)/10;
    return [key,{count:latencies.length,p50Ms:percentile(.5),p95Ms:percentile(.95),maximumMs:percentile(1)}];
}));
console.log(JSON.stringify({startedAt,releaseId:ready.releaseId,base:base.origin,requests:seconds*rps,rps,
    elapsedSeconds:Math.round((performance.now()-started)/100)/10,summary,errors,
    scope:'VPS HTTP service time; local dictionary, local suggestions and retained audio only; no synthesis or editorial requests'},null,2));
if (errors.length) process.exitCode=1;
