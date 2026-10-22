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
