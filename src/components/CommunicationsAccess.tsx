import type {ReactNode} from 'react';
import {useApp} from '../context/AppContext';
export default function CommunicationsAccess({children,className}:{children:ReactNode;className?:string}){const {state}=useApp();const actor=state.user;if(!actor||!['owner','manager'].includes(actor.role))return <p role="status" className="p-6 text-gray-400">Communications require an owner or manager. Rep channel assignment is not configured.</p>;return <div className={className} key={actor.id+':'+actor.role}>{children}</div>;}
