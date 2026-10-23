import type { VercelRequest, VercelResponse } from '@vercel/node';
import { contactCaller, contactFailure, permittedContact, reject, jsonRequest, uuid } from './auth-server.js';
// Returns true once a response is sent; authorized legacy owner mutations continue in crm.ts.
export async function guardOrganizations(req:VercelRequest,res:VercelResponse):Promise<boolean>{
  try{
    const caller=await contactCaller(req,res),action=req.query.action;
    if(action==='getOrganizations'||action==='getMembers'){
      if(req.method!=='GET')reject(405,'GET required.');
      const members=action==='getMembers',id=members?req.query.organizationId:req.query.contactId;
      await permittedContact(caller,id,'id');
      const parent=members?'organization_id':'contact_id',foreign=members?'contact_id':'organization_id';
      const projection=`id,role,started_at,ended_at,is_primary,created_at,organization_id,contacts:contacts!${foreign}!inner(id,name,email,phone,company,contact_type,assigned_to)`;
      const base=()=>{let q=caller.admin.from('contact_organizations').select(projection).eq(parent,id);if(!caller.manager)q=q.eq('contacts.assigned_to',caller.id);if(members&&req.query.current!=='false')q=q.is('ended_at',null);return q;};
      const {data,error}=await base().order('id',{ascending:true}).limit(50);if(error)reject(503,'Organization review is unavailable.');
      const rows=(data||[]).filter((link:any)=>link.contacts&&!Array.isArray(link.contacts)).map((link:any)=>({linkId:link.id,id:link.contacts.id,memberId:link.contacts.id,name:link.contacts.name,email:link.contacts.email,phone:link.contacts.phone,company:link.contacts.company,contact_type:link.contacts.contact_type,role:link.role,startedAt:link.started_at,endedAt:link.ended_at,isPrimary:link.is_primary,isCurrent:!link.ended_at,status:link.ended_at?'ENDED':'ACTIVE'}));
      if(members)res.json({success:true,members:rows,count:rows.length,currentCount:rows.filter((row:any)=>row.isCurrent).length,bounded:true});
      else res.json({success:true,organizations:rows,current:rows.filter((row:any)=>row.isCurrent),historical:rows.filter((row:any)=>!row.isCurrent),bounded:true});return true;
    }
    if(!['linkContact','unlinkContact'].includes(String(action)))reject(400,'Unknown organization action.');
    if(req.method!=='POST')reject(405,'POST required.');jsonRequest(req);if(!caller.manager)reject(403,'Organization changes require an owner or manager.');
    if(action==='linkContact'){
      if(req.body.contactId===req.body.organizationId)reject(400,'Cannot link a contact to itself.');
      await permittedContact(caller,req.body.contactId,'id');await permittedContact(caller,req.body.organizationId,'id');
      if(req.body.role!==undefined&&(typeof req.body.role!=='string'||req.body.role.length>200))reject(400,'Invalid organization role.');
      for(const field of ['startedAt','endedAt'])if(req.body[field]&&!/^\d{4}-\d{2}-\d{2}$/.test(req.body[field]))reject(400,'Use YYYY-MM-DD organization dates.');
    }else{
      if(!uuid(req.body.linkId))reject(400,'Invalid organization link.');const {data,error}=await caller.admin.from('contact_organizations').select('contact_id,organization_id').eq('id',req.body.linkId).maybeSingle();if(error)reject(503,'Organization link is unavailable.');if(!data)reject(404,'Organization link is unavailable.');await permittedContact(caller,data.contact_id,'id');await permittedContact(caller,data.organization_id,'id');
    }
    return false;
  }catch(error){contactFailure(res,error);return true;}
}
