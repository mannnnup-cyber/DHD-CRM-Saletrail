// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import WooCommerce from '../src/pages/WooCommerce';
const m=vi.hoisted(()=>({role:'owner',deal:vi.fn(),lead:vi.fn()}));
vi.mock('../src/context/AuthContext',()=>({useAuth:()=>({user:{role:m.role}})}));
vi.mock('../src/context/AppContext',()=>({useApp:()=>({addDeal:m.deal,addLead:m.lead})}));
vi.mock('../src/lib/auth',()=>({authHeaders:()=>({Authorization:'Bearer synthetic'})}));
let host:HTMLDivElement,root:Root,net:ReturnType<typeof vi.fn>;
const ok=(data:any)=>({ok:true,json:async()=>({success:true,...data})});
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;m.role='owner';m.deal.mockClear();m.lead.mockClear();host=document.createElement('div');document.body.append(host);root=createRoot(host);localStorage.setItem('wc_orders','private cached order');net=vi.fn(async(url:string)=>{if(url.includes('action=configured'))return ok({configured:true,storeUrl:'https://store.example.test'});if(url.includes('action=syncStatus'))return ok({state:{mode:'initial',page:2}});if(url.includes('action=syncOrders'))return ok({checked:1,saved:1,complete:true});return ok({orders:[{id:'wc_1',orderId:1,orderNumber:'1',status:'custom-printing',customerName:'<img src=x onerror=evil()>',customerEmail:'customer@example.test',dateCreated:'2026-10-17',currency:'JMD',total:100,refundAmount:20,lineItems:[],notes:'<script>evil()</script>'}],total:1,pages:1});});vi.stubGlobal('fetch',net);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();localStorage.clear();});
async function mount(){await act(async()=>root.render(<WooCommerce/>));}
async function click(label:string){const b=[...host.querySelectorAll('button')].find(b=>b.textContent?.trim()===label);expect(b).toBeTruthy();await act(async()=>b!.click());}
it('mount reads only authenticated saved data, clears private cache and retains manual controls',async()=>{await mount();expect(localStorage.getItem('wc_orders')).toBeNull();expect(net.mock.calls.every(c=>c[1].headers.Authorization==='Bearer synthetic')).toBe(true);expect(net.mock.calls.some(c=>c[0].includes('action=syncOrders'))).toBe(false);expect(host.textContent).toContain('custom-printing');expect(host.querySelector('img')).toBeNull();expect(host.textContent).toContain('Import');expect(m.deal).not.toHaveBeenCalled();});
it('sync is explicit POST and progress is truthful',async()=>{await mount();await click('Sync Now');expect(net.mock.calls.find(c=>c[0].includes('action=syncOrders'))?.[1].method).toBe('POST');expect(host.textContent).toContain('Checked 1 orders; last batch saved 1. Pass complete.');expect(m.deal).not.toHaveBeenCalled();expect(m.lead).not.toHaveBeenCalled();});
it('reps see denial and no data requests',async()=>{m.role='rep';await mount();expect(host.textContent).toContain('requires an owner or manager');expect(net).not.toHaveBeenCalled();expect(localStorage.getItem('wc_orders')).toBeNull();});
it('unmapped status cannot silently create a New Lead deal',async()=>{await mount();await click('Import');expect(m.deal).not.toHaveBeenCalled();expect(host.textContent).toContain('No CRM stage mapping for custom-printing');});
