import {authHeaders} from '../auth';
export function communicationsFetch(url:string,options:RequestInit={}){
 if(!/^\/api\/(whatsapp|recordings)(?:\?|$)/.test(url))throw new Error('Communications requests require a same-origin API path.');
 const headers=new Headers(options.headers);headers.delete('Authorization');for(const [key,value] of Object.entries(authHeaders()))headers.set(key,value);
 return fetch(url,{...options,headers,redirect:'error',credentials:'same-origin'});
}
