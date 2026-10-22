import { describe, it, expect, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), role: 'owner', active: true, collision: false, authError: false, update: vi.fn(), ilike: vi.fn(), eq: vi.fn(), currentPhone: null as string | null }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
import { contactChanges, editContact } from './edit-server';
const id = '10000000-0000-4000-8000-000000000001';
const res = () => { const r: any = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() }; r.status.mockReturnValue(r); r.json.mockReturnValue(r); return r; };
beforeEach(() => {
  vi.stubEnv('SUPABASE_PROJECT_URL','https://synthetic.supabase.co'); vi.stubEnv('SUPABASE_ANON_KEY','synthetic-anon'); vi.stubEnv('SUPABASE_SECRET_KEY','synthetic-secret');
  mocks.currentPhone=null; mocks.role='owner'; mocks.active=true; mocks.collision=false; mocks.authError=false; mocks.update.mockReset(); mocks.eq.mockReset(); mocks.ilike.mockReset(); mocks.createClient.mockReset();
  mocks.createClient.mockImplementation((_url, key) => key === 'synthetic-anon' ? { auth: { getUser: async () => ({data:{user:{id}},error:mocks.authError}) } } : { from: (table: string) => {
    const query: any = { select: () => query, eq: (...args: any[]) => { mocks.eq(...args); return query; }, ilike: (...args: any[]) => { mocks.ilike(...args); return query; }, neq: () => query, limit: async () => ({ data: mocks.collision ? [{id:'other'}] : [], error:null }), update: (changes: any) => { mocks.update(changes); return query; }, maybeSingle: async () => ({ data: table === 'user_profiles' ? {id,role:mocks.role,is_active:mocks.active} : (mocks.update.mock.calls.length ? {id,email:'new@example.com'} : {id,email:'old@example.com',phone_normalized:mocks.currentPhone}), error:null }) }; return query;
  }});
});
const request = (body: any = {email:'new@example.com'}) => ({method:'POST',query:{id},headers:{authorization:'Bearer synthetic','content-type':'application/json'},body}) as any;
describe('contact corrections', () => {
 it('normalizes identifiers and clears nullable fields',()=>expect(contactChanges({email:' NEW@example.com ',phone:'+1 876 555 0100',company:''})).toEqual({email:'new@example.com',phone:'+1 876 555 0100',phone_normalized:'8765550100',company:null}));
 it.each([{email:'bad'},{assigned_to:id},{name:''},{phone:'123'},{phone:'-------'},{phone:'(      )'},{linkedin_url:'javascript:alert(1)'},{email:['a']}])('rejects malformed fields %j',body=>expect(()=>contactChanges(body)).toThrow());
 it('rejects missing authentication before creating clients',async()=>{const r=res(),q=request();delete q.headers.authorization;await editContact(q,r);expect(r.status).toHaveBeenCalledWith(401);expect(mocks.createClient).not.toHaveBeenCalled();});
 it('requires the modern secret with no legacy fallback',async()=>{vi.stubEnv('SUPABASE_SECRET_KEY','');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','legacy');const r=res();await editContact(request(),r);expect(r.status).toHaveBeenCalledWith(503);expect(mocks.update).not.toHaveBeenCalled();});
 it.each(['sales_rep','rep'])('denies %s before contact writes',async role=>{mocks.role=role;const r=res();await editContact(request(),r);expect(r.status).toHaveBeenCalledWith(403);expect(mocks.update).not.toHaveBeenCalled();});
 it('denies inactive owner',async()=>{mocks.active=false;const r=res();await editContact(request(),r);expect(r.status).toHaveBeenCalledWith(403);expect(mocks.update).not.toHaveBeenCalled();});
 it('denies expired token',async()=>{mocks.authError=true;const r=res();await editContact(request(),r);expect(r.status).toHaveBeenCalledWith(401);});
 it('rejects existing identifier without update',async()=>{mocks.collision=true;const r=res();await editContact(request(),r);expect(r.status).toHaveBeenCalledWith(409);expect(mocks.update).not.toHaveBeenCalled();});
 it('returns persisted fields on authorized save',async()=>{const r=res();await editContact(request(),r);expect(mocks.update).toHaveBeenCalledWith({email:'new@example.com'});expect(r.json).toHaveBeenCalledWith({success:true,contact:{id,email:'new@example.com'}});});
});

it('uses case-insensitive exact email match and escapes pattern metacharacters',async()=>{const r=res();await editContact(request({email:'A%_@Example.com'}),r);expect(mocks.ilike).toHaveBeenCalledWith('email','a\\%\\_@example.com');});

it('allows an active manager',async()=>{mocks.role='manager';const r=res();await editContact(request(),r);expect(mocks.update).toHaveBeenCalled();});
it.each([['GET',405],['DELETE',405]])('rejects %s',async(method,status)=>{const r=res(),q=request();q.method=method;await editContact(q,r);expect(r.status).toHaveBeenCalledWith(status);expect(mocks.update).not.toHaveBeenCalled();});
it('rejects invalid UUID',async()=>{const r=res(),q=request();q.query.id='bad';await editContact(q,r);expect(r.status).toHaveBeenCalledWith(400);expect(mocks.update).not.toHaveBeenCalled();});
it('rejects non-JSON content',async()=>{const r=res(),q=request();q.headers['content-type']='text/plain';await editContact(q,r);expect(r.status).toHaveBeenCalledWith(415);});

it('does not recheck an unchanged duplicated phone when correcting email',async()=>{mocks.currentPhone='8765550100';const r=res();await editContact(request({email:'new@example.com',phone:'+1 876 555 0100'}),r);expect(mocks.update).toHaveBeenCalledWith({email:'new@example.com',phone:'+1 876 555 0100',phone_normalized:'8765550100'});expect(mocks.eq.mock.calls.some(([field])=>field==='phone_normalized')).toBe(false);});
