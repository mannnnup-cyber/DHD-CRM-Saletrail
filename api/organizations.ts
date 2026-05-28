import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const _url = process.env.SUPABASE_PROJECT_URL || process.env.VITE_SUPABASE_URL || '';
const _key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = _url && _key ? createClient(_url, _key) : null;

/**
 * Link a contact to an organization with role and date range
 * POST /api/organizations?action=linkContact
 * Input: { contactId, organizationId, role?, startedAt?, endedAt?, isPrimary? }
 */
async function linkContact(req: VercelRequest, res: VercelResponse) {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  try {
    const { contactId, organizationId, role, startedAt, endedAt, isPrimary = false } = req.body;

    if (!contactId || !organizationId) {
      return res.status(400).json({
        success: false,
        error: 'contactId and organizationId required'
      });
    }

    // Prevent self-linking
    if (contactId === organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot link contact to itself'
      });
    }

    // Verify both contacts exist
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, name')
      .eq('id', contactId)
      .single();

    const { data: organization } = await supabase
      .from('contacts')
      .select('id, name, contact_type')
      .eq('id', organizationId)
      .single();

    if (!contact || !organization) {
      return res.status(404).json({
        success: false,
        error: 'Contact or organization not found'
      });
    }

    // Update contact_type if linking to organization
    if (organization.contact_type !== 'organization') {
      await supabase
        .from('contacts')
        .update({ contact_type: 'organization' })
        .eq('id', organizationId);
    }

    // If this is the primary link, remove primary from other links
    if (isPrimary) {
      await supabase
        .from('contact_organizations')
        .update({ is_primary: false })
        .eq('contact_id', contactId);
    }

    // Insert or update the relationship
    const { data: existingLink } = await supabase
      .from('contact_organizations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('organization_id', organizationId)
      .eq('started_at', startedAt)
      .single();

    let result;
    if (existingLink) {
      // Update existing link
      const { data, error } = await supabase
        .from('contact_organizations')
        .update({
          role: role || null,
          ended_at: endedAt || null,
          is_primary: isPrimary,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingLink.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new link
      const { data, error } = await supabase
        .from('contact_organizations')
        .insert({
          contact_id: contactId,
          organization_id: organizationId,
          role: role || null,
          started_at: startedAt || null,
          ended_at: endedAt || null,
          is_primary: isPrimary
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    // Create audit trail
    try {
      await supabase.from('interactions').insert({
        contact_id: contactId,
        type: 'NOTE',
        subject: `Linked to organization: ${organization.name}${role ? ` as ${role}` : ''}`,
        content: `Added organizational affiliation${role ? ` with role: ${role}` : ''}${startedAt ? ` starting ${startedAt}` : ''}${endedAt ? ` until ${endedAt}` : ' (ongoing)'}`,
        metadata: {
          organizationId,
          organizationName: organization.name,
          role,
          startedAt,
          endedAt
        },
        timestamp: new Date().toISOString()
      });
    } catch (interactionErr) {
      console.warn('[organizations] Warning creating interaction:', interactionErr);
    }

    return res.status(200).json({
      success: true,
      link: result
    });
  } catch (err: any) {
    console.error('[organizations] Link error:', err);
    return res.status(500).json({
      success: false,
      error: `Server error: ${err.message || 'Unknown error'}`
    });
  }
}

/**
 * Get organization info for a contact
 * GET /api/organizations?action=getOrganizations&contactId=...
 */
async function getOrganizations(req: VercelRequest, res: VercelResponse) {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  try {
    const { contactId } = req.query as Record<string, string>;

    if (!contactId) {
      return res.status(400).json({
        success: false,
        error: 'contactId required'
      });
    }

    // Get all organization links (both current and historical)
    const { data: links, error } = await supabase
      .from('contact_organizations')
      .select(`
        id,
        role,
        started_at,
        ended_at,
        is_primary,
        created_at,
        organization_id,
        contacts:organization_id (
          id,
          name,
          email,
          phone,
          company,
          contact_type
        )
      `)
      .eq('contact_id', contactId)
      .order('started_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        error: `Failed to fetch organizations: ${error.message}`
      });
    }

    // Transform data for frontend
    const organizations = (links || []).map((link: any) => ({
      linkId: link.id,
      id: link.contacts.id,
      name: link.contacts.name,
      email: link.contacts.email,
      phone: link.contacts.phone,
      company: link.contacts.company,
      role: link.role,
      startedAt: link.started_at,
      endedAt: link.ended_at,
      isPrimary: link.is_primary,
      isCurrent: !link.ended_at,
      status: link.ended_at ? 'ENDED' : 'ACTIVE'
    }));

    return res.status(200).json({
      success: true,
      organizations,
      current: organizations.filter(o => !o.endedAt),
      historical: organizations.filter(o => o.endedAt)
    });
  } catch (err: any) {
    console.error('[organizations] Get error:', err);
    return res.status(500).json({
      success: false,
      error: `Server error: ${err.message || 'Unknown error'}`
    });
  }
}

/**
 * Get members of an organization
 * GET /api/organizations?action=getMembers&organizationId=...&current=true
 */
async function getMembers(req: VercelRequest, res: VercelResponse) {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  try {
    const { organizationId, current = 'true' } = req.query as Record<string, string>;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'organizationId required'
      });
    }

    // Build query based on whether we want current or all members
    let query = supabase
      .from('contact_organizations')
      .select(`
        id,
        role,
        started_at,
        ended_at,
        is_primary,
        contacts:contact_id (
          id,
          name,
          email,
          phone,
          company
        )
      `)
      .eq('organization_id', organizationId);

    // Filter for current members if requested
    if (current === 'true') {
      query = query.is('ended_at', null);
    }

    const { data: links, error } = await query.order('started_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        error: `Failed to fetch members: ${error.message}`
      });
    }

    // Transform data
    const members = (links || []).map((link: any) => ({
      memberId: link.contacts.id,
      linkId: link.id,
      name: link.contacts.name,
      email: link.contacts.email,
      phone: link.contacts.phone,
      company: link.contacts.company,
      role: link.role,
      startedAt: link.started_at,
      endedAt: link.ended_at,
      isPrimary: link.is_primary,
      status: link.ended_at ? 'ENDED' : 'ACTIVE'
    }));

    return res.status(200).json({
      success: true,
      members,
      count: members.length,
      currentCount: members.filter(m => !m.endedAt).length
    });
  } catch (err: any) {
    console.error('[organizations] Members error:', err);
    return res.status(500).json({
      success: false,
      error: `Server error: ${err.message || 'Unknown error'}`
    });
  }
}

/**
 * Unlink a contact from an organization (soft delete by setting ended_at)
 * POST /api/organizations?action=unlinkContact
 * Input: { linkId }
 */
async function unlinkContact(req: VercelRequest, res: VercelResponse) {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  try {
    const { linkId } = req.body;

    if (!linkId) {
      return res.status(400).json({
        success: false,
        error: 'linkId required'
      });
    }

    // Get the link to get contact and org info
    const { data: link, error: linkError } = await supabase
      .from('contact_organizations')
      .select(`
        id,
        contact_id,
        organization_id,
        role,
        contacts:contact_id (id, name),
        contacts_org:organization_id (id, name)
      `)
      .eq('id', linkId)
      .single();

    if (linkError || !link) {
      return res.status(404).json({
        success: false,
        error: 'Link not found'
      });
    }

    // Soft delete by setting ended_at to today
    const { error: updateError } = await supabase
      .from('contact_organizations')
      .update({
        ended_at: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        updated_at: new Date().toISOString()
      })
      .eq('id', linkId);

    if (updateError) {
      return res.status(500).json({
        success: false,
        error: `Failed to unlink: ${updateError.message}`
      });
    }

    // Create audit trail
    try {
      await supabase.from('interactions').insert({
        contact_id: link.contact_id,
        type: 'NOTE',
        subject: 'Unlinked from organization',
        content: `Removed affiliation with ${(link.contacts_org as any)?.name || 'organization'}${link.role ? ` (was ${link.role})` : ''}`,
        metadata: {
          organizationId: link.organization_id,
          role: link.role,
          unlinkedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    } catch (interactionErr) {
      console.warn('[organizations] Warning creating unlink interaction:', interactionErr);
    }

    return res.status(200).json({
      success: true,
      message: 'Contact unlinked from organization'
    });
  } catch (err: any) {
    console.error('[organizations] Unlink error:', err);
    return res.status(500).json({
      success: false,
      error: `Server error: ${err.message || 'Unknown error'}`
    });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const { action } = req.query as Record<string, string>;

  if (action === 'linkContact' && req.method === 'POST') {
    return linkContact(req, res);
  }

  if (action === 'getOrganizations' && req.method === 'GET') {
    return getOrganizations(req, res);
  }

  if (action === 'getMembers' && req.method === 'GET') {
    return getMembers(req, res);
  }

  if (action === 'unlinkContact' && req.method === 'POST') {
    return unlinkContact(req, res);
  }

  return res.status(404).json({ error: 'Action not found' });
}
