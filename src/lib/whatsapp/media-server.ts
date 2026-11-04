import type {VercelRequest,VercelResponse} from '@vercel/node';
import {authenticateEmail} from '../inbox/email-server.js';

export const MEDIA_BYTES=3*1024*1024;
export const PROXY_BYTES=4_400_000;
export const mediaMethods:Record<string,string>={sendFile:'POST',sendMedia:'POST',sendAudio:'POST',mediaProxy:'GET'};
export const isMediaAction=(action:unknown):action is string=>typeof action==='string'&&Object.prototype.hasOwnProperty.call(mediaMethods,action);
export function privateMediaHeaders(res:VercelResponse){res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');}
export async function mediaActor(req:VercelRequest,res:VercelResponse,databaseUrl:string){
 privateMediaHeaders(res);
 const actor=await authenticateEmail(req,res);if(!actor)return null;
 const expected=process.env.SUPABASE_PROJECT_URL||process.env.SUPABASE_URL;
 if(!expected||databaseUrl.replace(/\/+$/,'')!==expected.replace(/\/+$/,'')){res.status(503).json({success:false,error:'Media access is temporarily unavailable.'});return null;}
 privateMediaHeaders(res);return actor;
}
export class MediaInputError extends Error {constructor(public status:number,message:string){super(message);}}
export function mediaInput(body:unknown,action:string){
 if(!body||typeof body!=='object'||Array.isArray(body))throw new MediaInputError(400,'Provide media data.');
 const b=body as Record<string,unknown>;
 if(JSON.stringify(body).length>PROXY_BYTES)throw new MediaInputError(413,'Media must be at most 3 MiB.');
 const chatId=b.chatId;
 if(typeof chatId!=='string'||chatId.length>100||!(/^(?:\+?\d{5,20}(?:@(?:s\.whatsapp\.net|c\.us|lid))?|\d{5,20}(?:-\d{1,20})?@g\.us)$/.test(chatId)))throw new MediaInputError(400,'Provide a supported conversation identifier.');
 const audio=action==='sendAudio';
 const source=audio?b.audioBase64:action==='sendFile'?b.fileBase64:b.mediaBase64;
 if(typeof source!=='string'||!source.length)throw new MediaInputError(400,'Provide base64 media data.');
 let raw=source,embeddedMime='';
 if(source.startsWith('data:')){
  const match=source.match(/^data:([^,]{1,160});base64,([A-Za-z0-9+/]*={0,2})$/);
  if(!match)throw new MediaInputError(400,'Provide valid base64 media data.');
  embeddedMime=match[1].trim().toLowerCase();raw=match[2];
 }
 if(raw.length>Math.ceil(MEDIA_BYTES/3)*4)throw new MediaInputError(413,'Media must be at most 3 MiB.');
 if(!raw.length||raw.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(raw))throw new MediaInputError(400,'Provide valid base64 media data.');
 const bytes=Buffer.from(raw,'base64');
 if(bytes.toString('base64')!==raw)throw new MediaInputError(400,'Provide valid base64 media data.');
 if(!bytes.length||bytes.length>MEDIA_BYTES)throw new MediaInputError(413,'Media must be at most 3 MiB.');
 const supplied=b.mimeType??(typeof b.mediaType==='string'&&b.mediaType.includes('/')?b.mediaType:undefined);
 if(supplied!==undefined&&typeof supplied!=='string')throw new MediaInputError(400,'Provide a valid MIME type.');
 const mimeType=(supplied||embeddedMime||(audio?'audio/mpeg':'application/octet-stream')).toString().trim().toLowerCase();
 if(mimeType.length>160||!/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*(?:;\s*[a-z0-9_-]+=[a-z0-9_.+-]+)*$/.test(mimeType))throw new MediaInputError(400,'Provide a valid MIME type.');
 if(embeddedMime&&embeddedMime!==mimeType)throw new MediaInputError(400,'Media MIME types must agree.');
 if(audio&&!mimeType.startsWith('audio/'))throw new MediaInputError(415,'Audio requires an audio MIME type.');
 const fileName=audio?'voice-note':b.fileName;
 if(typeof fileName!=='string'||!fileName.trim()||fileName.length>254||/[\x00-\x1f\x7f/\\]/.test(fileName)||/^[.\s]+$/.test(fileName))throw new MediaInputError(400,'Provide a bounded file name without paths.');
 const caption=b.caption??'';
 if(typeof caption!=='string'||caption.length>1024)throw new MediaInputError(400,'Caption must be at most 1024 characters.');
 const kind=/^image\/(?:png|jpeg|jpg|webp|gif|avif|bmp)$/.test(mimeType)?'image':mimeType.startsWith('video/')?'video':mimeType.startsWith('audio/')?'audio':'document';
 return {chatId,base64:raw,mimeType,fileName:fileName.trim(),caption,kind,fileSize:bytes.length};
}
export function knownMediaId(data:any):string|null{
 if(!data||data.success===false||data.error)return null;
 const id=data.key?.id||data.data?.key?.id||data.id;
 return typeof id==='string'&&id.trim().length>0&&id.length<=512&&id!=='unknown'?id:null;
}
export function safeProxyMime(value:unknown){
 const mime=typeof value==='string'?value.split(';')[0].trim().toLowerCase():'';
 return /^(?:image\/(?:png|jpeg|jpg|webp|gif|avif|bmp|x-icon)|audio\/(?:mpeg|mp3|mp4|ogg|wav|x-wav|webm|aac|flac)|video\/(?:mp4|webm|ogg|quicktime))$/.test(mime)?mime:'application/octet-stream';
}
export function proxyBuffer(base64:unknown){
 if(typeof base64!=='string'||!base64.length||base64.length>Math.ceil(PROXY_BYTES/3)*4+200)throw new MediaInputError(413,'Media exceeds the supported response size.');
 const match=base64.match(/^data:([^,]{1,160});base64,(.+)$/s);
 const raw=match?match[2]:base64;
 if(!raw.length||raw.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(raw))throw new MediaInputError(502,'Media response is unavailable.');
 const buffer=Buffer.from(raw,'base64');if(buffer.length>PROXY_BYTES)throw new MediaInputError(413,'Media exceeds the supported response size.');
 if(buffer.toString('base64')!==raw)throw new MediaInputError(502,'Media response is unavailable.');
 return {buffer,mime:safeProxyMime(match?.[1])};
}
export function proxyHeaders(res:VercelResponse,mime:string){privateMediaHeaders(res);res.setHeader('Content-Type',mime);res.setHeader('Content-Disposition',mime==='application/octet-stream'?'attachment':'inline');res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'");}
export async function boundedProxyBytes(response:Response){
 const length=response.headers?.get('content-length');
 if(length&&/^\d+$/.test(length)&&Number(length)>PROXY_BYTES)throw new MediaInputError(413,'Media exceeds the supported response size.');
 if(!response.body?.getReader){const value=Buffer.from(await response.arrayBuffer());if(value.length>PROXY_BYTES)throw new MediaInputError(413,'Media exceeds the supported response size.');return value;}
 const reader=response.body.getReader();const chunks:Buffer[]=[];let count=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;count+=value.length;if(count>PROXY_BYTES){await reader.cancel();throw new MediaInputError(413,'Media exceeds the supported response size.');}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
 return Buffer.concat(chunks,count);
}
