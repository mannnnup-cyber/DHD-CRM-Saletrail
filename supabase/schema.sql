-- ============================================
-- DHD CRM SalesTrail - Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'sales_rep' CHECK (role IN ('admin', 'manager', 'sales_rep')),
    avatar_url TEXT,
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- LEADS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    source VARCHAR(100),
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- DEALS TABLE (Pipeline)
-- ============================================
CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    value DECIMAL(15, 2) DEFAULT 0,
    stage VARCHAR(50) DEFAULT 'New Lead' CHECK (stage IN ('New Lead', 'Consultation', 'Quote Sent', 'Design Review', 'In Production', 'Delivered', 'Lost')),
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    expected_close_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CALLS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) CHECK (type IN ('Incoming', 'Outgoing', 'WhatsApp')),
    phone_number VARCHAR(50),
    contact_name VARCHAR(255),
    duration INTEGER DEFAULT 0,
    notes TEXT,
    rep_id UUID REFERENCES users(id) ON DELETE SET NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recording_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TASKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    completed BOOLEAN DEFAULT false,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ACTIVITIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) CHECK (type IN ('call', 'deal_moved', 'quote_created', 'task_completed', 'lead_created', 'note_added')),
    description TEXT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- QUOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_number VARCHAR(50) UNIQUE NOT NULL,
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    total_amount DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'expired')),
    valid_until DATE,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INVOICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    amount DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    due_date DATE,
    paid_date DATE,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TEAM MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    position VARCHAR(100),
    department VARCHAR(100),
    hire_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- UNIFIED CONTACTS TABLE
-- ============================================
-- This table replaces the need for separate leads and WooCommerce customers
-- All contacts (leads, customers, etc.) are stored here with source tracking
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    phone_normalized VARCHAR(50), -- Normalized phone for matching (e.g., +1XXXXXXXXXX)
    company VARCHAR(255),
    source VARCHAR(50) CHECK (source IN ('MANUAL', 'WOOCOMMERCE', 'CSV_IMPORT', 'WHATSAPP', 'WEBSITE')),
    status VARCHAR(50) DEFAULT 'NEW' CHECK (status IN ('NEW', 'CONTACTED', 'QUALIFYING', 'VERIFIED_CUSTOMER', 'CONVERTED', 'LOST')),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    tags TEXT[], -- Array of tags for segmentation
    total_orders INTEGER DEFAULT 0, -- From WooCommerce
    total_revenue DECIMAL(15, 2) DEFAULT 0, -- From WooCommerce
    first_order_date DATE, -- From WooCommerce
    last_order_date DATE, -- From WooCommerce
    average_order_value DECIMAL(15, 2) DEFAULT 0, -- Calculated from WooCommerce
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- WOOCOMMERCE ORDERS TABLE
-- ============================================
-- Stores cached orders from WooCommerce for trend analysis
CREATE TABLE IF NOT EXISTS woo_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    woo_order_id VARCHAR(100) UNIQUE NOT NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    billing_address TEXT,
    shipping_address TEXT,
    subtotal DECIMAL(15, 2) DEFAULT 0,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    shipping_amount DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'JMD',
    status VARCHAR(50) CHECK (status IN ('pending', 'processing', 'completed', 'cancelled', 'refunded', 'failed')),
    payment_method VARCHAR(50),
    order_notes TEXT,
    line_items JSONB, -- Store line items as JSON
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ORDER TRENDS TABLE
-- ============================================
-- Aggregated order data for trend analysis
CREATE TABLE IF NOT EXISTS order_trends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    period_type VARCHAR(20) CHECK (period_type IN ('daily', 'weekly', 'monthly', 'yearly')),
    period_start DATE NOT NULL,
    order_count INTEGER DEFAULT 0,
    revenue DECIMAL(15, 2) DEFAULT 0,
    average_order_value DECIMAL(15, 2) DEFAULT 0,
    first_order DATE,
    last_order DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INTERACTIONS TABLE
-- ============================================
-- Unified table for all communications (WhatsApp, calls, emails, notes)
CREATE TABLE IF NOT EXISTS interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    type VARCHAR(50) CHECK (type IN ('WHATSAPP', 'CALL', 'EMAIL', 'NOTE', 'SMS', 'MEETING')),
    direction VARCHAR(20) CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    subject VARCHAR(255),
    content TEXT,
    metadata JSONB, -- Store extra data like WhatsApp message ID, call duration, etc.
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- LEAD STAGES TABLE
-- ============================================
-- Track lead progression through qualification pipeline
CREATE TABLE IF NOT EXISTS lead_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    stage VARCHAR(50) CHECK (stage IN ('NEW', 'CONTACTED', 'QUALIFYING', 'VERIFIED', 'PROPOSAL', 'NEGOTIATION', 'CONVERTED', 'LOST')),
    notes TEXT,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- WOOCOMMERCE SYNC TABLE (Legacy - for backward compatibility)
-- ============================================
CREATE TABLE IF NOT EXISTS woocommerce_sync (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(100) UNIQUE NOT NULL,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    total_amount DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- WHATSAPP MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_number VARCHAR(50) NOT NULL,
    to_number VARCHAR(50),
    message TEXT NOT NULL,
    direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')),
    status VARCHAR(20) DEFAULT 'sent',
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDICES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON deals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_calls_rep_id ON calls(rep_id);
CREATE INDEX IF NOT EXISTS idx_calls_timestamp ON calls(timestamp);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp);

-- Indices for unified contacts
CREATE INDEX IF NOT EXISTS idx_contacts_phone_normalized ON contacts(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_source ON contacts(source);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to ON contacts(assigned_to);

-- Indices for WooCommerce orders
CREATE INDEX IF NOT EXISTS idx_woo_orders_contact_id ON woo_orders(contact_id);
CREATE INDEX IF NOT EXISTS idx_woo_orders_status ON woo_orders(status);
CREATE INDEX IF NOT EXISTS idx_woo_orders_created_at ON woo_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_woo_orders_customer_email ON woo_orders(customer_email);

-- Indices for order trends
CREATE INDEX IF NOT EXISTS idx_order_trends_contact_id ON order_trends(contact_id);
CREATE INDEX IF NOT EXISTS idx_order_trends_period ON order_trends(period_type, period_start);

-- Indices for interactions
CREATE INDEX IF NOT EXISTS idx_interactions_contact_id ON interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON interactions(type);
CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions(timestamp);

-- Indices for lead stages
CREATE INDEX IF NOT EXISTS idx_lead_stages_contact_id ON lead_stages(contact_id);
CREATE INDEX IF NOT EXISTS idx_lead_stages_stage ON lead_stages(stage);

-- ============================================
-- INSERT DEFAULT DATA
-- ============================================

-- Insert default admin user
INSERT INTO users (id, email, name, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin@dirtyhand.designs', 'Admin User', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Insert sample sales team
INSERT INTO users (email, name, role) VALUES
('keisha@dirtyhand.designs', 'Keisha Brown', 'sales_rep'),
('andre@dirtyhand.designs', 'Andre Williams', 'sales_rep'),
('marcia@dirtyhand.designs', 'Marcia Thompson', 'sales_rep'),
('devon@dirtyhand.designs', 'Devon Campbell', 'sales_rep'),
('tanya@dirtyhand.designs', 'Tanya Reid', 'manager')
ON CONFLICT (email) DO NOTHING;

-- Insert default settings
INSERT INTO settings (key, value, description) VALUES
('company_name', 'Dirty Hand Designs', 'Company name'),
('currency', 'JMD', 'Default currency'),
('timezone', 'America/Jamaica', 'Default timezone'),
('whatsapp_enabled', 'true', 'Enable WhatsApp integration'),
('woocommerce_enabled', 'true', 'Enable WooCommerce integration')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE woocommerce_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Public read access for demo (in production, restrict this)
CREATE POLICY "Allow public read access" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON leads FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON deals FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON calls FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON tasks FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON activities FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON quotes FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON invoices FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON team_members FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON settings FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON woocommerce_sync FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON whatsapp_messages FOR SELECT USING (true);

-- Allow all inserts/updates/deletes for demo
CREATE POLICY "Allow all access" ON users FOR ALL USING (true);
CREATE POLICY "Allow all access" ON leads FOR ALL USING (true);
CREATE POLICY "Allow all access" ON deals FOR ALL USING (true);
CREATE POLICY "Allow all access" ON calls FOR ALL USING (true);
CREATE POLICY "Allow all access" ON tasks FOR ALL USING (true);
CREATE POLICY "Allow all access" ON activities FOR ALL USING (true);
CREATE POLICY "Allow all access" ON quotes FOR ALL USING (true);
CREATE POLICY "Allow all access" ON invoices FOR ALL USING (true);
CREATE POLICY "Allow all access" ON team_members FOR ALL USING (true);
CREATE POLICY "Allow all access" ON settings FOR ALL USING (true);
CREATE POLICY "Allow all access" ON woocommerce_sync FOR ALL USING (true);
CREATE POLICY "Allow all access" ON whatsapp_messages FOR ALL USING (true);

-- Enable RLS on new tables
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE woo_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_stages ENABLE ROW LEVEL SECURITY;

-- RLS policies for new tables
CREATE POLICY "Allow all access" ON contacts FOR ALL USING (true);
CREATE POLICY "Allow all access" ON woo_orders FOR ALL USING (true);
CREATE POLICY "Allow all access" ON order_trends FOR ALL USING (true);
CREATE POLICY "Allow all access" ON interactions FOR ALL USING (true);
CREATE POLICY "Allow all access" ON lead_stages FOR ALL USING (true);

-- ============================================
-- FUNCTION TO UPDATE UPDATED_AT TIMESTAMP
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Schema complete
SELECT 'Database schema created successfully!' AS status;
