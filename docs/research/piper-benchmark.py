import io,json,time,wave,statistics,resource,importlib.metadata
from piper import PiperVoice
start=time.perf_counter(); voice=PiperVoice.load('/research/word-atlas-ljspeech.onnx'); load=time.perf_counter()-start
words=['hello','serendipity','ubiquitous','ephemeral','read','lead','record','colonel','quinoa','Worcestershire','break the ice','a blessing in disguise','throw in the towel','on the spur of the moment','pneumonoultramicroscopicsilicovolcanoconiosis']
rows=[]
for repeat in range(5):
 for word in words:
  buf=io.BytesIO(); start=time.perf_counter()
  with wave.open(buf,'wb') as out: voice.synthesize_wav(word,out)
  elapsed=time.perf_counter()-start
  with wave.open(io.BytesIO(buf.getvalue())) as inp: duration=inp.getnframes()/inp.getframerate()
  rows.append({'round':repeat,'word':word,'synthesis_ms':round(elapsed*1000,2),'audio_seconds':round(duration,2)})
result={'date':'2026-10-26','host':'vps','cpu':'AMD EPYC virtual; Docker capped at 1 CPU and 512 MiB','engine':'piper-tts','version':importlib.metadata.version('piper-tts'),'voice':'en_US-ljspeech-medium','load_seconds':load,'median_ms':statistics.median(x['synthesis_ms'] for x in rows),'p95_ms':sorted(x['synthesis_ms'] for x in rows)[int(len(rows)*.95)],'max_ms':max(x['synthesis_ms'] for x in rows),'max_rss_mib':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024,'rows':rows}
open('/research/piper-vps-benchmark.json','w').write(json.dumps(result,indent=2))
print(json.dumps({k:v for k,v in result.items() if k!='rows'}))
