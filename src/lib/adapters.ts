import { Lead, Call, Deal, Task, Activity } from '../data/types';

export function rowToLead(r: any): Lead {
  return {
    id: String(r.id || ''),
    name: String(r.name || r.full_name || ''),
    company: String(r.company || ''),
    email: String(r.email || ''),
    phone: String(r.phone || r.phone_number || ''),
    source: String(r.source || ''),
  status: (function(s:any){ const v = String(s || r.lead_status || 'New'); return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();})(r.status) as any,
    assignedTo: String(r.assigned_to || r.assignedTo || ''),
    notes: r.notes || r.description || '',
    createdAt: r.created_at || r.createdAt || new Date().toISOString(),
    address: r.address || '',
    category: r.category || ''
  } as Lead;
}

export function rowToDeal(r: any): Deal {
  return {
    id: String(r.id || ''),
    contactId: String(r.lead_id || r.contact_id || ''),
    name: String(r.name || ''),
    value: Number(r.value || r.amount || 0),
    stage: String(r.stage || 'New Lead') as any,
    repId: String(r.assigned_to || r.rep_id || ''),
    createdAt: r.created_at || new Date().toISOString(),
    updatedAt: r.updated_at || new Date().toISOString(),
    description: r.notes || '',
    expectedCloseDate: r.expected_close_date || r.expectedCloseDate || undefined
  } as Deal;
}

export function rowToCall(r: any): Call {
  return {
    id: String(r.id || ''),
    contactId: String(r.contact_id || r.contactId || ''),
    type: (r.type || r.call_type || 'Outgoing') as any,
    duration: Number(r.duration || 0),
    timestamp: r.timestamp || r.created_at || new Date().toISOString(),
    repId: String(r.rep_id || r.repId || ''),
    notes: r.notes || ''
  } as Call;
}

export function rowToTask(r: any): Task {
  return {
    id: String(r.id || ''),
    contactId: String(r.contact_id || r.contactId || ''),
    title: String(r.title || r.name || ''),
    dueDate: r.due_date || r.dueDate || new Date().toISOString(),
    completed: Boolean(r.completed || false),
    repId: String(r.assigned_to || r.repId || ''),
    priority: (r.priority || 'medium') as any
  } as Task;
}

export function rowToActivity(r: any): Activity {
  return {
    id: String(r.id || ''),
    contactId: String(r.contact_id || ''),
    type: String(r.type || ''),
    description: r.description || '',
    timestamp: r.timestamp || new Date().toISOString(),
    userId: r.user_id || ''
  } as Activity;
}

export default { rowToLead, rowToDeal, rowToCall, rowToTask, rowToActivity };
