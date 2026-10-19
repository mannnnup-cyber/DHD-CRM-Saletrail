import React,{useEffect,useState} from 'react';
import {studioRequest} from '../lib/publishing/client';
import {jamaicaDisplay} from '../lib/publishing/calendar';

/** Preview the saved revision, not the mutable composer fields, when approving. */
export default function PublishingPreview({snapshot,version,onApprove,busy=false}:{snapshot:any;version?:number;onApprove?:()=>void;busy?:boolean}) {
  const [images,setImages]=useState<any[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(false),[loaded,setLoaded]=useState<string[]>([]);
  const [previewKey,setPreviewKey]=useState('');
  const media=snapshot.media||[];
  const mediaKey=media.map((item:any)=>`${item.id}:${item.providerId}:${item.version}`).join('|');
  useEffect(()=>{
    let cancelled=false;setImages([]);setLoaded([]);setError('');setLoading(media.length>0);
    void Promise.all(media.map(async(item:any)=>{
      const result=await studioRequest('mediaPreview',undefined,{id:item.id});
      if(result.media.id!==item.providerId || !result.media.url)throw new Error('The selected image cannot be verified. Refresh the media library.');
      return result.media;
    })).then(rows=>{if(!cancelled){setImages(rows);setPreviewKey(mediaKey);}}).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Image preview unavailable.');}).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[mediaKey]);
  return <div className="rounded-xl border border-gray-700 p-4 space-y-3">
    <h3 className="font-semibold">{version?`Exact revision ${version}`:'Post preview'}</h3>
    <p className="whitespace-pre-wrap">{snapshot.caption||'Your caption appears here.'}</p>
    {snapshot.firstComment&&<div><h4>First comment</h4><p className="whitespace-pre-wrap">{snapshot.firstComment}</p></div>}
    <p>{(snapshot.accounts||[]).map((account:any)=>`${account.platform}${account.name?` — ${account.name}`:''}`).join(' • ')||'No destinations selected'}</p>
    <p>Jamaica: {snapshot.scheduledAt&&Number.isFinite(Date.parse(snapshot.scheduledAt))?jamaicaDisplay(snapshot.scheduledAt):'Choose a valid publication time'}</p>
    {loading&&<p role="status">Loading the selected image…</p>}
    {error&&<p role="alert" className="text-red-300">{error}</p>}
    {previewKey===mediaKey&&images.map(image=><figure key={image.id}><img src={image.url} alt={image.alt||image.title||image.filename} referrerPolicy="no-referrer" className="max-h-80 rounded-lg object-contain" onLoad={()=>setLoaded(ids=>ids.includes(image.id)?ids:[...ids,image.id])} onError={()=>setError('The image preview expired or could not load. Refresh before approval.')}/><figcaption>{image.title||image.filename}</figcaption></figure>)}
    {!media.length&&<p>Text-only post; no image selected.</p>}
    {onApprove&&<button className="bg-amber-500 text-black p-2 rounded-lg disabled:opacity-40" disabled={busy||loading||!!error||previewKey!==mediaKey||loaded.length!==media.length} onClick={onApprove}>Approve this exact revision</button>}
  </div>;
}
