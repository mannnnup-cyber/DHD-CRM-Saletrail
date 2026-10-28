import {useEffect,useState,type ImgHTMLAttributes,type AudioHTMLAttributes,type VideoHTMLAttributes,type AnchorHTMLAttributes} from 'react';
import {getAccessToken} from '../lib/auth';
import {communicationsFetch} from '../lib/communications/client';
export function useProtectedMedia(source:string|undefined){
 const token=getAccessToken(),[state,setState]=useState<{source:string;token:string|null;url:string;error:boolean}>({source:'',token:null,url:'',error:false});
 useEffect(()=>{const abort=new AbortController();let blobUrl='';if(!source)return()=>{};
  if(source.startsWith('data:')||source.startsWith('blob:')){setState({source,token,url:source,error:false});return()=>{};}
  if(!source.startsWith('/api/whatsapp?action=mediaProxy')){setState({source,token,url:'',error:true});return()=>{};}
  setState({source,token,url:'',error:false});
  communicationsFetch(source,{signal:abort.signal,cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error('Media unavailable');const length=Number(response.headers.get('content-length')||0);if(length>20*1024*1024)throw new Error('Media too large');const blob=await response.blob();if(blob.size>20*1024*1024)throw new Error('Media too large');if(abort.signal.aborted)return;blobUrl=URL.createObjectURL(blob);setState({source,token,url:blobUrl,error:false});}).catch(()=>{if(!abort.signal.aborted)setState({source,token,url:'',error:true});});
  return()=>{abort.abort();if(blobUrl)URL.revokeObjectURL(blobUrl);};
 },[source,token]);
 return state.source===source&&state.token===token?state:{url:'',error:false};
}
export function ProtectedImage({src,...props}:ImgHTMLAttributes<HTMLImageElement>){const media=useProtectedMedia(src);return media.url?<img {...props} src={media.url}/>:<span role="status" className="text-xs text-gray-400">{media.error?'Media unavailable':'Loading media...'}</span>;}
export function ProtectedAudio({src,...props}:AudioHTMLAttributes<HTMLAudioElement>){const media=useProtectedMedia(src);return media.url?<audio {...props} src={media.url}/>:<span role="status">{media.error?'Audio unavailable':'Loading audio...'}</span>;}
export function ProtectedVideo({src,...props}:VideoHTMLAttributes<HTMLVideoElement>){const media=useProtectedMedia(src);return media.url?<video {...props} src={media.url}/>:<span role="status">{media.error?'Video unavailable':'Loading video...'}</span>;}
export function ProtectedDownload({href,target:_target,download,...props}:AnchorHTMLAttributes<HTMLAnchorElement>){const media=useProtectedMedia(href);return media.url?<a {...props} download={download||true} href={media.url}/>:<span role="status">{media.error?'Download unavailable':'Preparing download...'}</span>;}
