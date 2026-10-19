// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import PublishingPreview from '../src/components/PublishingPreview';
import ContentStudio from '../src/pages/ContentStudio';
import {studioRequest} from '../src/lib/publishing/client';
vi.mock('../src/context/AppContext',()=>({useApp:()=>({state:{user:{role:'owner'}}})}));
vi.mock('../src/lib/publishing/client',()=>({studioRequest:vi.fn(async()=>({media:{id:'provider',url:'/synthetic.png',title:'Approved shirt'}}))}));
const snapshot={caption:'Full approved caption '.repeat(30),firstComment:'Exact first comment',accounts:[{platform:'instagram',name:'Synthetic business'}],scheduledAt:'2026-11-20T15:00:00Z',media:[{id:'local',providerId:'provider',version:1}]};
let root:ReturnType<typeof createRoot>|undefined;
afterEach(async()=>{if(root)await act(async()=>root!.unmount());document.body.innerHTML='';vi.clearAllMocks();});
it('shows the full approved material and waits for the exact image to load',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);root=createRoot(host);const approve=vi.fn();
 await act(async()=>root!.render(<PublishingPreview snapshot={snapshot} version={4} onApprove={approve}/>));
 expect(host.textContent).toContain(snapshot.caption);expect(host.textContent).toContain('Exact first comment');expect(host.textContent).toContain('Synthetic business');expect(host.textContent).toContain('10:00 am');
 const button=host.querySelector('button')!;expect(button.disabled).toBe(true);
 await act(async()=>host.querySelector('img')!.dispatchEvent(new Event('load')));expect(button.disabled).toBe(false);
 await act(async()=>button.click());expect(approve).toHaveBeenCalledOnce();
 await act(async()=>host.querySelector('img')!.dispatchEvent(new Event('error')));expect(button.disabled).toBe(true);
});
it('allows text-only review without pretending an image is present',async()=>{
 const host=document.createElement('div');document.body.append(host);root=createRoot(host);
 await act(async()=>root!.render(<PublishingPreview snapshot={{...snapshot,media:[]}} onApprove={()=>{}}/>));
 expect(host.querySelector('img')).toBeNull();expect(host.textContent).toContain('Text-only post');expect(host.querySelector('button')!.disabled).toBe(false);
});
it('wires the real studio review to the exact saved revision and approval command',async()=>{
 const post={id:'post',version:4,state:'awaiting_approval',snapshot,scheduled_at:snapshot.scheduledAt};
 vi.mocked(studioRequest).mockImplementation(async(action:string)=>{
   if(action==='readiness')return {accounts:[{id:'account',platform:'instagram',name:'Synthetic business'}]};
   if(action==='store')return {posts:[post],total:1,offset:0,media:[],campaigns:[]};
   if(action==='detail')return {post,deliveries:[],operations:[],approvals:[]};
   if(action==='mediaPreview')return {media:{id:'provider',url:'/synthetic.png',title:'Approved shirt'}};
   return {success:true};
 });
 const host=document.createElement('div');document.body.append(host);root=createRoot(host);
 await act(async()=>root!.render(<ContentStudio/>));
 const review=Array.from(host.querySelectorAll('button')).find(button=>button.textContent==='Review exact revision');expect(review).toBeDefined();
 await act(async()=>review!.click());
 expect(host.textContent).toContain(snapshot.caption);
 const approve=Array.from(host.querySelectorAll('button')).find(button=>button.textContent==='Approve this exact revision')!;
 expect(approve.disabled).toBe(true);await act(async()=>host.querySelector('img')!.dispatchEvent(new Event('load')));expect(approve.disabled).toBe(false);
 await act(async()=>approve.click());expect(studioRequest).toHaveBeenCalledWith('approve',{id:'post',version:4});
});
