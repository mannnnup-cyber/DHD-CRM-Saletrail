export const JAMAICA_TIMEZONE='America/Jamaica';
export function jamaicaToUtc(value:string) {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Choose a valid Jamaica date and time.');
  const date=new Date(`${value}:00-05:00`);
  if(!Number.isFinite(date.getTime()) || toJamaicaInput(date.toISOString())!==value) throw new Error('Choose a valid Jamaica date and time.');
  return date.toISOString();
}
export function toJamaicaInput(value:string) { const d=new Date(Date.parse(value)-5*3600000);return Number.isFinite(d.getTime())?d.toISOString().slice(0,16):''; }
export const jamaicaDisplay=(value:string|null)=>value?new Intl.DateTimeFormat('en-JM',{timeZone:JAMAICA_TIMEZONE,dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Not scheduled';
export function calendarDays(anchor:string,view:'month'|'week') {
  const date=new Date(`${anchor}T12:00:00Z`);if(view==='month')date.setUTCDate(1);
  const offset=(date.getUTCDay()+6)%7;date.setUTCDate(date.getUTCDate()-offset);
  return Array.from({length:view==='month'?42:7},(_,i)=>new Date(date.getTime()+i*86400000).toISOString().slice(0,10));
}
export function conflicts(posts:any[]) { const result=new Set<string>();for(let i=0;i<posts.length;i++)for(let j=i+1;j<posts.length;j++){if(posts[i].scheduled_at&&posts[i].scheduled_at===posts[j].scheduled_at&&posts[i].snapshot.accounts.some((a:any)=>posts[j].snapshot.accounts.some((b:any)=>a.id===b.id))){result.add(posts[i].id);result.add(posts[j].id);}}return result; }
