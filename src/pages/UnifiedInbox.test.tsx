// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const actor = vi.hoisted(()=>({role:'owner'}));
vi.mock('../context/AppContext',()=>({useApp:()=>({state:{user:{id:'synthetic',role:actor.role}}})}));
vi.mock('../lib/auth',()=>({authHeaders:()=>({Authorization:'Bearer synthetic'})}));
vi.mock('../components/SocialInbox',()=>({default:()=>null}));
import UnifiedInbox from './UnifiedInbox';
let root:Root,container:HTMLDivElement;
const flush=()=>act(async()=>{for(let i=0;i<10;i++)await Promise.resolve();});
beforeEach(async()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;actor.role='owner';container=document.createElement('div');document.body.append(container);root=createRoot(container);vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,json:async()=>url.includes('action=sync')?{success:true,synced:2}:{success:true,items:[],nextCursor:'synthetic-cursor'}})));await act(async()=>root.render(<UnifiedInbox/>));await flush();});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
const button=(text:string)=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent===text)!;
it('refresh returns from older pages to the latest saved messages',async()=>{await act(async()=>button('Next page').click());await flush();expect(String(vi.mocked(fetch).mock.calls.at(-1)?.[0])).toContain('cursor=');await act(async()=>button('Refresh saved emails').click());await flush();expect(String(vi.mocked(fetch).mock.calls.at(-1)?.[0])).not.toContain('cursor=');expect(button('Previous page').disabled).toBe(true);});
it('explicit mailbox sync is authenticated and never requests AI',async()=>{await act(async()=>button('Sync latest emails').click());await flush();const call=vi.mocked(fetch).mock.calls.find(([url])=>String(url).includes('action=sync'))!;expect(call[1]).toMatchObject({method:'POST',headers:{Authorization:'Bearer synthetic'},body:'{"skipAi":true}'});expect(container.textContent).toContain('Saved 2 new emails');});
it('does not start provider sync on mount',()=>expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).includes('action=sync'))).toBe(false));
it('hides sync from reps while preserving WhatsApp navigation',async()=>{actor.role='rep';await act(async()=>root.render(<UnifiedInbox/>));expect(container.textContent).not.toContain('Sync latest emails');expect(container.querySelector('a[href="#/whatsapp"]')).toBeTruthy();});

it('aborts owner sync and ignores late results after role changes',async()=>{let resolve:any;vi.mocked(fetch).mockImplementation(async(url:any)=>String(url).includes('action=sync')?await new Promise(r=>resolve=r):({ok:true,json:async()=>({success:true,items:[]})}) as any);await act(async()=>button('Sync latest emails').click());const call=vi.mocked(fetch).mock.calls.find(([url])=>String(url).includes('action=sync'))!;actor.role='rep';await act(async()=>root.render(<UnifiedInbox/>));expect((call[1]?.signal as AbortSignal).aborted).toBe(true);await act(async()=>resolve({ok:true,json:async()=>({success:true,synced:999})}));await flush();expect(container.textContent).not.toContain('999');});

it('reports partial failure, refreshes newest saved emails and does not retry provider sync',async()=>{
  await act(async()=>button('Next page').click());await flush();
  vi.mocked(fetch).mockClear();
  vi.mocked(fetch).mockImplementation(async(url:any)=>String(url).includes('action=sync')?({ok:false,status:502,json:async()=>({success:false,synced:3,error:'Some emails could not be saved.'})}) as any:({ok:true,json:async()=>({success:true,items:[],nextCursor:null})}) as any);
  await act(async()=>button('Sync latest emails').click());await flush();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Sync incomplete: Some emails could not be saved. Saved 3 new emails before the failure.');
  expect(vi.mocked(fetch).mock.calls.filter(([url])=>String(url).includes('action=sync'))).toHaveLength(1);
  expect(vi.mocked(fetch).mock.calls.find(([url])=>String(url).includes('action=inbox'))?.[0]).toBe('/api/email?action=inbox&limit=25');
  expect(button('Previous page').disabled).toBe(true);
});
it('keeps zero-saved failure visible without claiming success or reloading',async()=>{
  vi.mocked(fetch).mockClear();vi.mocked(fetch).mockResolvedValue({ok:false,status:502,json:async()=>({success:false,synced:0,error:'Unable to read mailbox.'})} as any);
  await act(async()=>button('Sync latest emails').click());await flush();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Saved 0 new emails before the failure.');expect(vi.mocked(fetch).mock.calls).toHaveLength(1);
});
it('explains a timeout with unknown saved count and reloads saved messages only',async()=>{
  vi.mocked(fetch).mockClear();vi.mocked(fetch).mockImplementation(async(url:any)=>String(url).includes('action=sync')?({ok:false,status:504,json:async()=>({success:false,error:'Email sync timed out.'})}) as any:({ok:true,json:async()=>({success:true,items:[]})}) as any);
  await act(async()=>button('Sync latest emails').click());await flush();
  const notice=container.querySelector('[role="alert"]')?.textContent;expect(notice).toContain('Some emails may have been saved');expect(notice).not.toMatch(/Saved \d/);expect(vi.mocked(fetch).mock.calls.filter(([url])=>String(url).includes('action=sync'))).toHaveLength(1);expect(vi.mocked(fetch).mock.calls.filter(([url])=>String(url).includes('action=inbox'))).toHaveLength(1);
});
it('does not invent a saved count after a lost network response',async()=>{
  vi.mocked(fetch).mockClear();vi.mocked(fetch).mockImplementation(async(url:any)=>{if(String(url).includes('action=sync'))throw new Error('Synthetic connection loss');return {ok:true,json:async()=>({success:true,items:[]})} as any;});
  await act(async()=>button('Sync latest emails').click());await flush();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('could not be confirmed');expect(container.textContent).not.toContain('Saved 0');expect(vi.mocked(fetch).mock.calls).toHaveLength(2);
});
