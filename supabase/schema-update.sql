-- ============================================
-- DHD CRM - Additional Tables Only
-- Run this to add new tables without conflicts
-- ============================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- UNIFIED CONTACTS TABLE
-- ============================================
-- This table replaces the need for separate leads and WooCommerce customers
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    phone_normalized VARCHAR(50),
    company VARCHAR(255),
    source VARCHAR(50) CHECK (source IN ('MANUAL', 'WOOCOMMERCE', 'CSV_IMPORT', 'WHATSAPP', 'WEBSITE')),
    status VARCHAR(50) DEFAULT 'NEW' CHECK (status IN ('NEW', 'CONTACTED', 'QUALIFYING', 'VERIFIED_CUSTOMER', 'CONVERTED', 'LOST')),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    tags TEXT[],
    total_orders INTEGER DEFAULT 0,
    total_revenue DECIMAL(15, 2) DEFAULT 0,
    first_order_date DATE,
    last_order_date DATE,
    average_order_value DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- WOOCOMMERCE ORDERS TABLE
-- ============================================
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
    line_items JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ORDER TRENDS TABLE
-- ============================================
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
CREATE TABLE IF NOT EXISTS interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    type VARCHAR(50) CHECK (type IN ('WHATSAPP', 'CALL', 'EMAIL', 'NOTE', 'SMS', 'MEETING')),
    direction VARCHAR(20) CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    subject VARCHAR(255),
    content TEXT,
    metadata JSONB,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- LEAD STAGES TABLE
-- ============================================
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
-- INDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_contacts_phone_normalized ON contacts(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_source ON contacts(source);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to ON contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_woo_orders_contact_id ON woo_orders(contact_id);
CREATE INDEX IF NOT EXISTS idx_woo_orders_status ON woo_orders(status);
CREATE INDEX IF NOT EXISTS idx_woo_orders_created_at ON woo_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_trends_contact_id ON order_trends(contact_id);
CREATE INDEX IF NOT EXISTS idx_interactions_contact_id ON interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_lead_stages_contact_id ON lead_stages(contact_id);

-- ============================================
-- RLS POLICIES (only create if table exists and no policy)
-- ============================================
DO $$
BEGIN
    -- Contacts table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contacts') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access' AND tablename = 'contacts') THEN
            ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
            CREATE POLICY "Allow all access" ON contacts FOR ALL USING (true);
        END IF;
    END IF;

    -- Woo orders table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'woo_orders') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access' AND tablename = 'woo_orders') THEN
            ALTER TABLE woo_orders ENABLE ROW LEVEL SECURITY;
            CREATE POLICY "Allow all access" ON woo_orders FOR ALL USING (true);
        END IF;
    END IF;

    -- Order trends table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_trends') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access' AND tablename = 'order_trends') THEN
            ALTER TABLE order_trends ENABLE ROW LEVEL SECURITY;
            CREATE POLICY "Allow all access" ON order_trends FOR ALL USING (true);
        END IF;
    END IF;

    -- Interactions table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'interactions') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access' AND tablename = 'interactions') THEN
            ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
            CREATE POLICY "Allow all access" ON interactions FOR ALL USING (true);
        END IF;
    END IF;

    -- Lead stages table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lead_stages') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access' AND tablename = 'lead_stages') THEN
            ALTER TABLE lead_stages ENABLE ROW LEVEL SECURITY;
            CREATE POLICY "Allow all access" ON lead_stages FOR ALL USING (true);
        END IF;
    END IF;
END $$;

-- ============================================
-- ADD PHONE COLUMN TO LEADS (if not exists)
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'phone') THEN
        -- Column exists, do nothing
    ELSE
        ALTER TABLE leads ADD COLUMN phone VARCHAR(50);
    END IF;
END $$;

-- ============================================
-- ADD PHONE COLUMN TO USERS (if not exists)
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone') THEN
        -- Column exists, do nothing
    ELSE
        ALTER TABLE users ADD COLUMN phone VARCHAR(50);
    END IF;
END $$;

SELECT 'Database schema updated successfully!' as result;
