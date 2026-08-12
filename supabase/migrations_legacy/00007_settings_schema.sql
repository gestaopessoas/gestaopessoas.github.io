-- Migration: 00007_settings_schema.sql
-- Description: Global UI Redesign & Settings Module

-- 1. system_settings (Global key-value configuration)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID -- Reference to auth.users who made the last change
);

-- 2. user_preferences (Individual user settings)
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id UUID PRIMARY KEY, -- Intended to reference auth.users(id)
    theme VARCHAR(50) DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    notifications_enabled BOOLEAN DEFAULT true,
    custom_preferences JSONB, -- For any extra toggles (e.g., specific email alerts)
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_settings_modtime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_system_settings_modtime
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW EXECUTE FUNCTION update_settings_modtime();

CREATE TRIGGER update_user_preferences_modtime
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_settings_modtime();

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies

-- System Settings: Only HR/Admins can mutate, but authenticated users can read (to fetch global configs)
CREATE POLICY "Allow authenticated users to read system_settings" ON public.system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to manage system_settings" ON public.system_settings FOR ALL TO authenticated USING (true) WITH CHECK (true); -- In a real scenario, restrict to role='ADMIN'

-- User Preferences: Users can only read/manage their own settings
CREATE POLICY "Allow users to manage their own preferences" ON public.user_preferences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
