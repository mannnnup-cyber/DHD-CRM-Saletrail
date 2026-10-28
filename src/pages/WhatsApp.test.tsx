// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../context/AppContext', () => ({ useApp: () => ({ state: { user: { id: 'owner-1', name: 'Owner', role: 'owner' } }, addCall: vi.fn() }) }));
vi.mock('../lib/supabase', () => ({ supabase: {} }));
const session=vi.hoisted(()=>({token:'synthetic'}));
vi.mock('../lib/auth', () => ({ getAccessToken:()=> session.token, authHeaders: () => ({ Authorization: 'Bearer synthetic' }) }));
import WhatsApp from './WhatsApp';
let root: Root; let container: HTMLDivElement; let unavailable = false;
const chat = { id: '18760000000@s.whatsapp.net', name: 'Synthetic customer', lastMessage: 'Synthetic incoming', timestamp: '2026-10-21T12:00:00Z', unread: 0 };
let sourceChats = [chat];
const incomingId = '10000000-0000-4000-8000-000000000001';
const outgoingId = '10000000-0000-4000-8000-000000000002';
const flush = () => act(async () => { for (let i=0; i<12; i++) await Promise.resolve(); });
beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; unavailable=false; sourceChats=[chat];session.token='synthetic';
  Object.defineProperty(document,'visibilityState',{ configurable:true,value:'visible' });
  HTMLElement.prototype.scrollIntoView=vi.fn();
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    const action = new URL(url,'https://local.test').searchParams.get('action');
    const values: Record<string, any> = {
      status: {success:true, connected:true}, webhookInfo: {success:true,configured:true},
      chatsFromDb: {success:true,chats:sourceChats}, getEvolutionConfig: {success:true,apiUrl:'https://provider.example'},
      inboxUnread: unavailable ? {success:false,error:'CRM unread tracking unavailable'} : {success:true,counts:[{chat_id:chat.id,unread_count:1300}]},
      messages: {success:true,messages:[{id:'provider1',storageId:incomingId,text:'Synthetic incoming',timestamp:1792584000,fromMe:false,status:'unknown',type:'text'},{id:'provider2',storageId:outgoingId,text:'Synthetic outgoing',timestamp:1792584001,fromMe:true,status:'unknown',type:'text'}]},
      inboxSeen: {success:true}, phoneAssignments: {success:true,items:(JSON.parse(String(options?.body||'{}')).chatIds||[]).map((chatId:string)=>({chatId,labelIds:['1','2','99'],checkedAt:Date.now(),expiresAt:Date.now()+180000}))},
      phoneLabels: {success:true,writesEnabled:false,labels:[{id:'1',name:'Shared name',color:'2'},{id:'2',name:'Shared name',color:'3'}]},
    };
    return {ok: !(unavailable && action==='inboxUnread'),json:async()=>values[action || ''] || {success:true,calls:[],users:[]}};
  }));
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(async()=>root.render(<WhatsApp/>)); await flush();
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('WhatsApp label and unread UI',()=>{
  it.each(['same','switched'])('unconfirmed send preserves only the %s chat draft',async mode=>{
    sourceChats=[chat,{...chat,id:'18760000001@s.whatsapp.net',name:'Second conversation'}];
    const refresh=Array.from(container.querySelectorAll('button')).find(b=>b.title==='Refresh from database + pull latest from Evolution API')!;
    await act(async()=>refresh.click());await flush();
    const first=Array.from(container.querySelectorAll('button')).find(b=>b.textContent?.includes('Synthetic customer'))!;await act(async()=>first.click());await flush();
    let resolve:any;const baseline=vi.mocked(fetch).getMockImplementation()!;vi.mocked(fetch).mockImplementation((url:any,options:any)=>String(url).includes('action=send')?new Promise(r=>{resolve=r;}):baseline(url,options));
    const input=container.querySelector('textarea')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,'Draft from first chat');input.dispatchEvent(new Event('input',{bubbles:true}));});
    await act(async()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));await flush();expect(resolve).toBeTypeOf('function');
    if(mode==='switched'){const second=Array.from(container.querySelectorAll('button')).find(b=>b.textContent?.includes('Second conversation'))!;await act(async()=>second.click());await flush();}
    resolve({ok:false,json:async()=>({success:false,error:'Synthetic denial'})});await flush();
    expect((container.querySelector('textarea') as HTMLTextAreaElement).value).toBe(mode==='same'?'Draft from first chat':'');
    if(mode==='same')expect(container.textContent).toContain('Message was not confirmed');else expect(container.textContent).not.toContain('Draft from first chat');
  });
  it('keeps one phone label menu, preserves duplicate names and shows read-only limitation',async()=>{
    const button=Array.from(container.querySelectorAll('button')).find(b=>b.textContent===' Phone labels') || Array.from(container.querySelectorAll('button')).find(b=>b.textContent?.includes('Phone labels'));
    expect(button).toBeTruthy();await act(async()=>button!.click());await flush();
    const region=container.querySelector('[aria-label="Phone labels"]')!;
    expect(region.textContent).toContain('Assignment changes are awaiting activation');
    expect(region.querySelectorAll('li')).toHaveLength(2);expect(region.textContent).toContain('(#1)');expect(region.textContent).toContain('(#2)');
  });
  it('caps positive unread badge and marks only loaded inbound UUIDs, without phone read receipts',async()=>{
    expect(container.textContent).toContain('99+');
    const button=Array.from(container.querySelectorAll('button')).find(b=>b.textContent?.includes('Synthetic customer'))!;
    await act(async()=>button.click());await flush();
    const calls=vi.mocked(fetch).mock.calls;
    const seen=calls.filter(([url])=>String(url).includes('action=inboxSeen'));
    expect(seen.length).toBeGreaterThan(0);expect(JSON.parse(String(seen[0][1]?.body))).toEqual({chatId:chat.id,messageIds:[incomingId]});
    expect(calls.some(([url])=>String(url).includes('action=readChat'))).toBe(false);
    expect(container.querySelector('[title="Delivery status unavailable"]')).toBeTruthy();
  });
  it('reports unavailable instead of false zero counts when migration is absent',async()=>{
    unavailable=true;
    const button=Array.from(container.querySelectorAll('button')).find(b=>b.title==='Refresh from database + pull latest from Evolution API')!;
    await act(async()=>button.click());await flush();
    expect(container.textContent).toContain('CRM unread tracking unavailable');
    expect(container.textContent).not.toContain('99+');
  });
  it('keeps supported unread counts when unsupported conversations are mixed in',async()=>{
    sourceChats=[chat,{...chat,id:'status@broadcast',name:'Unsupported customer'}];
    const refresh=Array.from(container.querySelectorAll('button')).find(b=>b.title==='Refresh from database + pull latest from Evolution API')!;
    vi.mocked(fetch).mockClear(); await act(async()=>refresh.click());await flush();
    const unreadCalls=vi.mocked(fetch).mock.calls.filter(([url])=>String(url).includes('action=inboxUnread'));
    expect(unreadCalls.length).toBeGreaterThan(0);
    for(const call of unreadCalls)expect(JSON.parse(String(call[1]?.body))).toEqual({chatIds:[chat.id]});
    expect(container.textContent).toContain('99+');expect(container.textContent).toContain('Unread tracking is unavailable for 1 conversation');
    expect(container.querySelector('[aria-label="Unread state unavailable"]')).toBeTruthy();
    const unsupported=Array.from(container.querySelectorAll('button')).find(b=>b.textContent?.includes('Unsupported customer'))!;
    await act(async()=>unsupported.click());await flush();
    expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).includes('action=inboxSeen'))).toBe(false);
  });
  it('makes no unread request when all displayed identifiers are unsupported',async()=>{
    sourceChats=[{...chat,id:'status@broadcast',name:'Unsupported customer'}];
    const refresh=Array.from(container.querySelectorAll('button')).find(b=>b.title==='Refresh from database + pull latest from Evolution API')!;
    vi.mocked(fetch).mockClear(); await act(async()=>refresh.click());await flush();
    expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).includes('action=inboxUnread'))).toBe(false);
    expect(container.textContent).toContain('their unread state is unknown');expect(container.textContent).not.toContain('99+');
    expect(container.querySelector('[aria-label="Unread state unavailable"]')).toBeTruthy();
  });

  it('does not fan out label requests on mount or ordinary inbox refresh',async()=>{
    expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).includes('action=phoneAssignments'))).toBe(false);
    const refresh=Array.from(container.querySelectorAll('button')).find(b=>b.title==='Refresh from database + pull latest from Evolution API')!;
    await act(async()=>refresh.click());await flush();
    expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).includes('action=phoneAssignments'))).toBe(false);
  });
  it('shows at most two chips plus overflow and filters checked membership only',async()=>{
    const menu=Array.from(container.querySelectorAll('button')).find(b=>b.textContent?.includes('Phone labels'))!;await act(async()=>menu.click());await flush();
    const chips=container.querySelector('[aria-label="Phone conversation labels"]')!;expect(chips).toBeTruthy();expect(chips.children).toHaveLength(3);expect(chips.textContent).toContain('+1');expect(container.textContent).toContain('Verified labels: 1 / 1');
    const select=container.querySelector('select[aria-label="Filter by phone label"]') as HTMLSelectElement;
    await act(async()=>{select.value='none';select.dispatchEvent(new Event('change',{bubbles:true}));});expect(container.textContent).toContain('No chats found');expect(container.textContent).toContain('Filter matches checked conversations only.');
  });
  it('gates assignment controls until explicitly enabled and an exact chat has readback',async()=>{
    const customer=Array.from(container.querySelectorAll('button')).find(b=>b.textContent?.includes('Synthetic customer'))!;await act(async()=>customer.click());await flush();
    const menu=Array.from(container.querySelectorAll('button')).find(b=>b.textContent?.includes('Phone labels'))!;await act(async()=>menu.click());await flush();
    const region=container.querySelector('[aria-label="Phone labels"]')!;expect(Array.from(region.querySelectorAll('input[type="checkbox"]')).every(input=>(input as HTMLInputElement).disabled)).toBe(true);expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).includes('action=phoneLabelChange'))).toBe(false);
  });

  it('checks only a demand-loaded batch and lets the owner explicitly check the next batch',async()=>{
    sourceChats=Array.from({length:60},(_,i)=>({...chat,id:String(18760001000+i)+'@s.whatsapp.net',name:'Synthetic '+i}));
    const refresh=Array.from(container.querySelectorAll('button')).find(b=>b.title==='Refresh from database + pull latest from Evolution API')!;await act(async()=>refresh.click());await flush();
    const menu=Array.from(container.querySelectorAll('button')).find(b=>b.textContent?.includes('Phone labels'))!;await act(async()=>menu.click());await flush();
    const requests=()=>vi.mocked(fetch).mock.calls.filter(([url])=>String(url).includes('action=phoneAssignments'));
    expect(requests()).toHaveLength(1);expect(JSON.parse(String(requests()[0][1]?.body)).chatIds).toHaveLength(25);expect(container.textContent).toContain('Verified labels: 25 / 60');
    const next=Array.from(container.querySelectorAll('button')).find(b=>b.textContent==='Check next 25')!;await act(async()=>next.click());await flush();expect(requests()).toHaveLength(2);expect(container.textContent).toContain('Verified labels: 50 / 60');
  });
  it('expires cached UI membership to unknown without another provider request',async()=>{
    const menu=Array.from(container.querySelectorAll('button')).find(b=>b.textContent?.includes('Phone labels'))!;await act(async()=>menu.click());await flush();
    const calls=vi.mocked(fetch).mock.calls.length;vi.spyOn(Date,'now').mockReturnValue(Date.now()+181000);
    const select=container.querySelector('select[aria-label="Filter by phone label"]') as HTMLSelectElement;await act(async()=>{select.value='unknown';select.dispatchEvent(new Event('change',{bubbles:true}));});
    expect(container.textContent).toContain('Verified labels: 0 / 1');expect(container.querySelector('[aria-label="Phone conversation labels"]')).toBeNull();expect(vi.mocked(fetch).mock.calls).toHaveLength(calls);
  });

});


describe('WhatsApp inbox UI and attachment lifecycle',()=>{
  async function open(){await act(async()=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent?.includes('Synthetic customer'))!.click());await flush();}
  async function choose(size=4){const file=new File([new Uint8Array(size)],'invoice.pdf',{type:'application/pdf'});const input=container.querySelector('input[type=file]')!;await act(async()=>{Object.defineProperty(input,'files',{configurable:true,value:[file]});input.dispatchEvent(new Event('change',{bubbles:true}));});return file;}
  async function send(){await act(async()=> (container.querySelector('[aria-label="Attachment draft"]')!.querySelectorAll('button')[1] as HTMLButtonElement).click());await flush();}
  function reader(){let current:any;class Reader{readyState=1;result:any;onload:any;onerror:any;onabort:any;readAsDataURL=vi.fn(()=>{current=this;});abort(){this.readyState=2;this.onabort?.();}}vi.stubGlobal('FileReader',Reader);return ()=>current;}
  it('owns a bounded full-height workspace and mobile back navigation',async()=>{expect(container.querySelector('[data-testid="whatsapp-workspace"]')?.className).toContain('min-h-0');expect(container.querySelector('[data-testid="whatsapp-workspace"]')?.getAttribute('style')||'').not.toContain('340');await open();expect(container.querySelector('[data-testid="whatsapp-composer"]')).toBeTruthy();await act(async()=> (container.querySelector('[aria-label="Back to conversations"]') as HTMLButtonElement).click());expect(container.querySelector('[aria-label="Conversation"]')?.className).toContain('hidden');});
  it('rejects oversized files before reading or sending and preserves the draft',async()=>{await open();const read=reader();await choose(3*1024*1024+1);await send();expect(read()).toBeUndefined();expect(container.textContent).toContain('Maximum attachment size');expect(container.querySelector('[aria-label="Attachment draft"]')).toBeTruthy();expect(vi.mocked(fetch).mock.calls.some(([u])=>String(u).includes('action=sendFile'))).toBe(false);});
  it('catches asynchronous file read failures without false success',async()=>{await open();const read=reader();await choose();await send();await act(async()=>read().onerror());await flush();expect(container.textContent).toContain('File could not be read');expect(container.querySelector('[aria-label="Attachment draft"]')).toBeTruthy();});
  it('does not dispatch a read completed under a changed token',async()=>{await open();const read=reader();await choose();await send();session.token='changed';await act(async()=>{read().result='data:application/pdf;base64,YQ==';read().onload();});await flush();expect(vi.mocked(fetch).mock.calls.some(([u])=>String(u).includes('action=sendFile'))).toBe(false);});
  it('locks uncertain dispatched uploads after a token change without painting success',async()=>{await open();const read=reader();let resolve:any;const baseline=vi.mocked(fetch).getMockImplementation()!;vi.mocked(fetch).mockImplementation((u:any,o:any)=>String(u).includes('action=sendFile')?new Promise(r=>{resolve=r;}):baseline(u,o));await choose();await send();await act(async()=>{read().result='data:application/pdf;base64,YQ==';read().onload();});await flush();expect(resolve).toBeTypeOf('function');session.token='changed';resolve({ok:true,status:200,json:async()=>({success:true,messageId:'sent'})});await flush();expect(container.textContent).toContain('Upload outcome is unknown');expect((container.querySelector('[aria-label="Attachment draft"]')!.querySelectorAll('button')[1] as HTMLButtonElement).disabled).toBe(true);});
  it('keeps Escape closed when focus returns from a search result',async()=>{const baseline=vi.mocked(fetch).getMockImplementation()!;vi.mocked(fetch).mockImplementation((u:any,o:any)=>String(u).includes('action=searchUnified')?Promise.resolve({ok:true,json:async()=>({success:true,results:[{id:chat.id,type:'chat',chatId:chat.id,name:'Result one',phone:'18760000000',status:'active'}]})} as any):baseline(u,o));const input=container.querySelector('[aria-label="Search WhatsApp conversations"]') as HTMLInputElement;await act(async()=>{input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'Result');input.dispatchEvent(new Event('input',{bubbles:true}));});await act(async()=>{await new Promise(r=>setTimeout(r,360));});await flush();const result=container.querySelector('[data-search-result]') as HTMLButtonElement;expect(result).toBeTruthy();await act(async()=>{result.focus();result.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));});await flush();expect(document.activeElement).toBe(input);expect(container.querySelector('#whatsapp-search-results')).toBeNull();});
});
