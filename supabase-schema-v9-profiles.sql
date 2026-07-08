-- 1. Criação da Tabela Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name text,
  avatar_url text,
  level integer DEFAULT 1, -- Nível hierárquico (ex: 100 para Super Admin, 1 para Padrão)
  permissions jsonb DEFAULT '{}'::jsonb, -- Objeto JSON com as permissões granulares por módulo
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Segurança de Nível de Linha (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all actions for anon" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- 3. Trigger para criar profile automaticamente quando usuário for criado no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, level, permissions)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'name', 'Usuário'),
    COALESCE((new.raw_user_meta_data->>'level')::integer, 1),
    COALESCE((new.raw_user_meta_data->>'permissions')::jsonb, '{}'::jsonb)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
