import {authHeaders} from '../auth';
export async function studioRequest(action:string,body?:any,query:Record<string,string>={}) {
 const params=new URLSearchParams({module:'publishing',action,...query}),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
 try{const response=await fetch(`/api/social?${params}`,{method:body===undefined?'GET':'POST',signal:controller.signal,headers:{...authHeaders(),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});const data=await response.json();if(!response.ok||!data.success)throw new Error(data.error||'Content Studio request failed.');return data;}
 catch(error){if(error instanceof Error&&error.name==='AbortError')throw new Error('Request timed out. A provider operation may still be running. Refresh history before submitting anything again.');throw error;}finally{clearTimeout(timer);}
}
