// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
vi.mock('../context/AppContext',()=>({useApp:()=>({state:{user:{name:'Synthetic',role:'owner'},tasks:[]},logout:vi.fn()})}));
import Sidebar from './Sidebar';
let root:Root,container:HTMLDivElement;
beforeEach(async()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();vi.stubGlobal('fetch',vi.fn());container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(<Sidebar sidebarOpen={false} onCloseSidebar={()=>{}}/>));});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
it('collapses persistently with accessible labeled navigation and full mobile width',async()=>{const toggle=container.querySelector<HTMLButtonElement>('[aria-label="Collapse navigation"]')!;await act(async()=>toggle.click());expect(localStorage.getItem('follops_sidebar_collapsed')).toBe('true');expect(container.querySelector('aside')?.className).toContain('lg:w-20');expect(container.querySelector('aside')?.className).toContain('w-64');expect(container.querySelector('[aria-label="Expand navigation"]')?.getAttribute('aria-expanded')).toBe('false');expect(container.querySelector('[aria-label="WhatsApp Inbox"]')?.getAttribute('title')).toBe('WhatsApp Inbox');await act(async()=>root.unmount());root=createRoot(container);await act(async()=>root.render(<Sidebar sidebarOpen={true} onCloseSidebar={()=>{}}/>));expect(container.querySelector('[aria-label="Expand navigation"]')).toBeTruthy();});
it('does not poll public provider unread counts',()=>expect(fetch).not.toHaveBeenCalled());
