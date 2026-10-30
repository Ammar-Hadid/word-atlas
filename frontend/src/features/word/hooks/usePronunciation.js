import { useCallback, useEffect, useRef, useState } from 'react';
import { getPronunciationAudio, preparePronunciationAudio } from '../api/pronunciationApi.js';

export const audioStateLabel = {
    unavailable: 'Audio unavailable', allowance_exhausted: 'Audio allowance reached',
    uncertain: 'Recording needs review', failed: 'Audio unavailable', sign_in: 'Sign in to prepare audio',
};
const reasonLabel = {
    synthesis_disabled: 'New recordings are paused until the free allowance is verified. Saved Iapetus recordings remain available.',
    allowance_unverified: 'The free synthesis allowance has not been verified. Saved recordings remain available.',
    allowance_exhausted: 'The free synthesis allowance is exhausted. Saved recordings remain available.',
    outcome_uncertain: 'The recording outcome is uncertain. It will not be generated again automatically.',
    daily_request_limit: 'The daily recording limit has been reached. Saved recordings remain available.',
    low_disk: 'New recordings are paused while storage is low.',
    cached_file_missing: 'This saved recording needs to be restored. No replacement synthesis will be requested.',
    allowance_expired_before_dispatch: 'The verified free allowance expired before recording could start.',
};

export function usePronunciation(pronunciation,canPrepare) {
    const id=pronunciation?.id;
    const cachedUrl=pronunciation?.status==='ready'?pronunciation.url:null;
    const cachedAssetKey=pronunciation?.assetKey;
    const [state,setState]=useState({status:id?'loading':'unavailable',loaded:false});
    const [playingId,setPlaying]=useState(null);
    const [revision,setRevision]=useState(0);
    const audioRef=useRef(null);
    const clickRef=useRef(null);
    const readyRef=useRef(null);

    useEffect(()=>{
        if(!id) return;
        const controller=new AbortController();
        const audio=new Audio();
        audio.preload='auto';
        audioRef.current=audio;
        let timer;
        const update=next=>{if(!controller.signal.aborted)setState({...next,pronunciationId:id});};
        const stop=()=>{if(!controller.signal.aborted)setPlaying(null);};
        audio.onended=stop;
        audio.onpause=stop;
        audio.oncanplay=()=>{if(!controller.signal.aborted)setState(current=>({...current,loaded:true}));};
        audio.onerror=()=>{stop();update({status:'failed',reason:'The saved recording could not be downloaded. Try again when connected.'});};
        audio.onplaying=()=>{
            if(controller.signal.aborted)return;
            setPlaying(id);
            if(clickRef.current){
                const sample={pronunciationId:id,assetKey:readyRef.current?.assetKey,
                    clickToPlayingMs:performance.now()-clickRef.current.at,readyStateAtClick:clickRef.current.readyState};
                window.dispatchEvent(new CustomEvent('word-atlas:audio-playback',{detail:sample}));
                clickRef.current=null;
            }
        };
        const load=async()=>{
            update({status:'loading',loaded:false});
            try{
                let result=cachedUrl?{status:'ready',url:cachedUrl,assetKey:cachedAssetKey}:await getPronunciationAudio(id,controller.signal);
                if(result.status==='unprepared'){
                    if(!canPrepare){update({status:'sign_in'});return;}
                    result=await preparePronunciationAudio(id,controller.signal);
                }
                let attempts=0;
                while(result.status==='pending'&&attempts++<30&&!controller.signal.aborted){
                    update({...result,loaded:false});
                    await new Promise(resolve=>{timer=window.setTimeout(resolve,1000);controller.signal.addEventListener('abort',resolve,{once:true});});
                    if(controller.signal.aborted)return;
                    result=await getPronunciationAudio(id,controller.signal);
                }
                if(controller.signal.aborted)return;
                readyRef.current=result;
                update({...result,loaded:false});
                if(result.status==='ready'&&/^\/audio\/[a-f0-9]{64}\.mp3$/.test(result.url)){
                    audio.src=result.url;
                    audio.load();
                }
            }catch(error){
                if(error.name!=='AbortError')update({status:error.status===401?'sign_in':'failed',reason:'The recording could not be prepared. Try again when connected.'});
            }
        };
        void load();
        return()=>{
            controller.abort();window.clearTimeout(timer);audio.pause();
            audio.oncanplay=null;audio.onplaying=null;audio.onended=null;audio.onpause=null;audio.onerror=null;
            audio.removeAttribute('src');audio.load();audioRef.current=null;clickRef.current=null;
        };
    },[id,canPrepare,revision,cachedUrl,cachedAssetKey]);

    const play=useCallback(()=>{
        const audio=audioRef.current;
        if(!audio||!audio.src||state.status!=='ready'||state.pronunciationId!==id)return;
        clickRef.current={at:performance.now(),readyState:audio.readyState};
        audio.currentTime=0;
        void audio.play().catch(()=>{
            setPlaying(null);
            // Browser gesture restrictions do not change the selected voice or discard the recording.
            setState(current=>({...current,reason:'Tap Listen to allow playback in this browser.'}));
        });
    },[id,state.status,state.pronunciationId]);
    const retry=useCallback(()=>setRevision(value=>value+1),[]);
    const current=state.pronunciationId===id?state:{status:id?'loading':'unavailable',loaded:false};
    return { ...current,isPlaying:playingId===id,play,retry,description:reasonLabel[current.reason]??current.reason??audioStateLabel[current.status] };
}
