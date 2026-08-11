INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT (id) DO UPDATE SET public = true;
CREATE POLICY "Allow public read access to documents" ON storage.objects FOR SELECT USING (bucket_id = 'documents');
CREATE POLICY "Allow authenticated uploads to documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Allow authenticated deletes to documents" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents');