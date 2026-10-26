export interface ContactIdentity { id: string; name: string; email?: string | null; phone?: string | null; phone_normalized?: string | null; company?: string | null; source?: string; sources?: string[]; created_at?: string; contact_type?: string; }
export const emailIdentity = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';
export const phoneSuffix = (value: unknown) => typeof value === 'string' ? value.replace(/\D/g, '').slice(-10) : '';
export const fullPhone = (value: unknown) => typeof value === 'string' && /^\+[0-9 ()-]+$/.test(value.trim()) && value.replace(/\D/g,'').length >= 7 && value.replace(/\D/g,'').length <= 15 ? '+' + value.replace(/\D/g,'') : '';
export function matchingEvidence(left: Partial<ContactIdentity>, right: Partial<ContactIdentity>) {
  const matchedFields: string[] = [], conflictingFields: string[] = [], reasons: string[] = [];
  const emailA=emailIdentity(left.email), emailB=emailIdentity(right.email), phoneA=fullPhone(left.phone), phoneB=fullPhone(right.phone);
  const weakEmail=/^(unknown|none|noemail|notprovided|test|na|noreply|no-reply|info|sales|support|admin|office|contact|accounts|billing|hello|team|service|shared)@/.test(emailA);
  if(emailA && /^(info|sales|support|admin|office|contact|accounts|billing|hello|team|service)@/.test(emailA)) reasons.push('Role mailbox: potentially shared, not individual identity proof.');
  if(emailA && /^(unknown|none|noemail|notprovided|test|na|noreply|no-reply)@/.test(emailA)) reasons.push('Possible placeholder email; do not infer ownership.');
  if(emailA && emailB) { if(emailA===emailB) { matchedFields.push('email'); reasons.push('Exact case-folded email match; shared mailboxes are possible.'); } else conflictingFields.push('email'); }
  if(phoneA && phoneB && phoneA===phoneB) { matchedFields.push('phone'); reasons.push('Full international phone matches; ownership still needs verification.'); }
  else if(phoneSuffix(left.phone) && phoneSuffix(left.phone)===phoneSuffix(right.phone)) { matchedFields.push('legacy_phone'); reasons.push('Legacy phone suffix matches; country and ownership are unverified.'); }
  if(left.phone && right.phone && left.phone.replace(/\D/g,'') !== right.phone.replace(/\D/g,'')) { conflictingFields.push('phone'); reasons.push('Stored phone digits differ; country context and ownership need review.'); }
  if(left.name?.trim() && left.name.trim().toLowerCase()===right.name?.trim().toLowerCase()) { matchedFields.push('name'); reasons.push('Name matches; this alone does not establish identity.'); }
  if(left.company?.trim() && right.company?.trim()){if(left.company.trim().toLowerCase()===right.company.trim().toLowerCase()){matchedFields.push('company');reasons.push('Company matches; many different people can share a company.');}else conflictingFields.push('company');}
  if(left.contact_type && right.contact_type && left.contact_type!==right.contact_type) conflictingFields.push('contact_type');
  return { matchedFields, conflictingFields, category: conflictingFields.some(field=>field!=='company') ? 'conflicting' : matchedFields.some(field=>field==='phone'||field==='email'&&!weakEmail) ? 'exact' : 'possible', reasons };
}
export interface ContactConflict { code: string; sharedSaveAvailable?:boolean; reviewToken?:string; reviewExpiresAt?:number; reviewTarget?:string; sharedSaveGuidance?:string; matchScope?: 'identifiers' | 'discovery'; error: string; matchedFields: string[]; candidates: Array<ContactIdentity & ReturnType<typeof matchingEvidence>>; visibleCount: number; nextCursor: string | null; guidance: string; }
