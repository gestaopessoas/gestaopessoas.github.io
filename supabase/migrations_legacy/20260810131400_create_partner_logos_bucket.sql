-- Cria o bucket público para logos de parceiros
INSERT INTO storage.buckets (id, name, public) 
VALUES ('partner_logos', 'partner_logos', true) 
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso para o bucket partner_logos
-- Permitir acesso público para leitura
CREATE POLICY "Logos de parceiros são públicas" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'partner_logos');

-- Permitir upload apenas para usuários autenticados (Admin/RH)
CREATE POLICY "Apenas autenticados podem fazer upload de logos" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'partner_logos');

-- Permitir exclusão/edição para usuários autenticados (Admin/RH)
CREATE POLICY "Apenas autenticados podem atualizar logos" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'partner_logos');

CREATE POLICY "Apenas autenticados podem excluir logos" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'partner_logos');
