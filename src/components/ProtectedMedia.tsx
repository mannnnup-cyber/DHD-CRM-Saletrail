import {useEffect,useRef,useState,type ImgHTMLAttributes,type AudioHTMLAttributes,type VideoHTMLAttributes,type AnchorHTMLAttributes,type MouseEventHandler} from 'react';
import {getAccessToken} from '../lib/auth';
const MAX_MEDIA_BYTES=4_400_000;
// Bound transient browser work without caching private content or changing shared API limits.
let active=0;const waiting:Array<()=>void>=[];
async function limited<T>(work:()=>Promise<T>):Promise<T>{await new Promise<void>(resolve=>{const start=()=>{active++;resolve();};if(active<2)start();else waiting.push(start);});try{return await work();}finally{active--;waiting.shift()?.();}}
async function boundedBlob(response:Response,signal:AbortSignal){
 if(Number(response.headers.get('content-length')||0)>MAX_MEDIA_BYTES)throw new Error('Media too large');
 if(!response.body?.getReader){const blob=await response.blob();if(blob.size>MAX_MEDIA_BYTES)throw new Error('Media too large');return blob;}
 const reader=response.body.getReader(),parts:Uint8Array[]=[];let total=0;
 const cancel=()=>{void Promise.resolve(reader.cancel()).catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
 try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_MEDIA_BYTES)throw new Error('Media too large');parts.push(value);}}
 catch(error){await reader.cancel();throw error;}finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
 return new Blob(parts as BlobPart[],{type:response.headers.get('content-type')||'application/octet-stream'});
}

// Credentials stay in headers; every remote preview is a revocable, actor-bound blob.
export function useProtectedMedia(source:string|undefined,enabled=true){
 const token=getAccessToken(),[state,setState]=useState({source:'',token:null as string|null,url:'',error:false});
 useEffect(()=>{const abort=new AbortController();let blobUrl='',timedOut=false;
  if(!source||!enabled)return;
  if(source.startsWith('blob:')){setState({source,token,url:source,error:false});return;}
  if(!token||!source.startsWith('/api/whatsapp?action=mediaProxy&')){setState({source,token,url:'',error:true});return;}
  setState({source,token,url:'',error:false});
  limited(async()=>{
   if(abort.signal.aborted||getAccessToken()!==token)throw new Error('Cancelled');
   let rejectAbort:(reason:Error)=>void=()=>{};
   const aborted=new Promise<never>((_,reject)=>{rejectAbort=reject;});
   const onAbort=()=>rejectAbort(new Error('Media cancelled'));abort.signal.addEventListener('abort',onAbort,{once:true});
   const timer=setTimeout(()=>{timedOut=true;abort.abort();},25_000);
   try{return await Promise.race([aborted,(async()=>{
   const response=await fetch(source,{headers:{Authorization:`Bearer ${token}`},signal:abort.signal,cache:'no-store'});
   if(!response.ok)throw new Error('Media unavailable');
   const blob=await boundedBlob(response,abort.signal);
   if(abort.signal.aborted||getAccessToken()!==token)return;
   blobUrl=URL.createObjectURL(blob);setState({source,token,url:blobUrl,error:false});
   })()]);}finally{clearTimeout(timer);abort.signal.removeEventListener('abort',onAbort);}
  }).catch(()=>{if((timedOut||!abort.signal.aborted)&&getAccessToken()===token)setState({source,token,url:'',error:true});});
  return()=>{abort.abort();if(blobUrl)URL.revokeObjectURL(blobUrl);};
 },[source,token,enabled]);
 return enabled&&state.source===source&&state.token===token?state:{url:'',error:false};
}
export function ProtectedImage({src,...props}:ImgHTMLAttributes<HTMLImageElement>){const ref=useRef<HTMLSpanElement>(null),[near,setNear]=useState(false);useEffect(()=>{setNear(false);if(typeof IntersectionObserver==='undefined')return;const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setNear(true);observer.disconnect();}},{rootMargin:'100px'});if(ref.current)observer.observe(ref.current);return()=>observer.disconnect();},[src]);const media=useProtectedMedia(src,near);return <span ref={ref} className="inline-block min-h-8 min-w-8">{media.url?<img {...props} src={media.url}/>:near?<span role="status">{media.error?'Media unavailable':'Loading media...'}</span>:<button type="button" onClick={()=>setNear(true)}>Load image</button>}</span>;}
export function ProtectedAudio({src,...props}:AudioHTMLAttributes<HTMLAudioElement>){const [load,setLoad]=useState(false);useEffect(()=>setLoad(false),[src]);const media=useProtectedMedia(src,load);return media.url?<audio {...props} src={media.url}/>:<button type="button" disabled={load} onClick={()=>setLoad(true)}>{media.error?'Audio unavailable':load?'Loading audio...':'Load audio'}</button>;}
export function ProtectedVideo({src,...props}:VideoHTMLAttributes<HTMLVideoElement>){const [load,setLoad]=useState(false);useEffect(()=>setLoad(false),[src]);const media=useProtectedMedia(src,load);return media.url?<video {...props} src={media.url}/>:<button type="button" disabled={load} onClick={()=>setLoad(true)}>{media.error?'Video unavailable':load?'Loading video...':'Load video'}</button>;}
type DownloadProps=Omit<AnchorHTMLAttributes<HTMLAnchorElement>,'onClick'>&{onClick?:MouseEventHandler<HTMLElement>};
export function ProtectedDownload({href,target:_target,download,children,onClick,...props}:DownloadProps){const [load,setLoad]=useState(false);useEffect(()=>setLoad(false),[href]);const media=useProtectedMedia(href,load);return media.url?<a {...props} onClick={onClick} download={download||true} href={media.url}>{children}</a>:<button type="button" className={props.className} disabled={load} onClick={event=>{onClick?.(event);if(!event.defaultPrevented)setLoad(true);}}>{media.error?'Download unavailable':load?'Preparing download...':<>Load attachment{typeof download==='string'?`: ${download}`:''}</>}</button>;}
