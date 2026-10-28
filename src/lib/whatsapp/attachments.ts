export const MAX_ATTACHMENT_BYTES=3*1024*1024;
export const MAX_ATTACHMENT_PAYLOAD_BYTES=4_400_000;
export function attachmentMetadata(row:Record<string,any>){
 const bounded=(value:unknown,max:number)=>typeof value==='string'?value.replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,max):'';
 const marker=typeof row.body==='string'?row.body.match(/^\[(?:File|[^\]\s]+\/[^\]:]+):\s*(.+)\]$/i):null;
 const fileName=bounded(row.fileName||row.attachment_file_name||row.attachment_nested_file_name||marker?.[1],254);
 const mimeType=bounded(row.mimeType||row.attachment_mime_type||row.attachment_nested_mime_type,100);
 const rawSize=row.fileSize??row.attachment_file_size??row.attachment_nested_file_size;
 const fileSize=(typeof rawSize==='number'||(typeof rawSize==='string'&&/^\d+$/.test(rawSize)))?Number(rawSize):NaN;
 return {fileName:fileName||undefined,mimeType:mimeType||undefined,fileSize:rawSize!==null&&rawSize!==undefined&&Number.isSafeInteger(fileSize)&&fileSize>=0?fileSize:undefined};
}
export function attachmentKind(type:string,mimeType?:string){
 if(type?.includes('image')||mimeType?.startsWith('image/'))return 'Image';
 if(type?.includes('video')||mimeType?.startsWith('video/'))return 'Video';
 if(type?.includes('audio')||type==='pttMessage'||mimeType?.startsWith('audio/'))return 'Audio';
 return mimeType==='application/pdf'?'PDF document':'Document';
}
export function attachmentSize(bytes?:number){if(bytes===undefined)return '';return bytes<1024?`${bytes} B`:bytes<1024*1024?`${Math.ceil(bytes/1024)} KB`:`${(bytes/(1024*1024)).toFixed(1)} MB`;}

