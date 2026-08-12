CREATE TABLE public.uniform_inventory (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  piece_type text NOT NULL,
  size text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  
  -- Proteções fundamentais:
  CONSTRAINT uniform_inventory_quantity_check CHECK (quantity >= 0),
  CONSTRAINT uniform_inventory_piece_size_key UNIQUE (piece_type, size)
);

ALTER TABLE public.uniform_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all actions for anon" ON public.uniform_inventory FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION distribute_uniforms(
  p_employee_id uuid,
  p_delivery_date date,
  p_items jsonb -- Formato: [{"inventory_id": "uuid", "qty": 1}]
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_item record;
  v_inv_record record;
  v_history_text text := '';
  v_separator text := '';
BEGIN
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(inventory_id uuid, qty int)
  LOOP
    SELECT * INTO v_inv_record
    FROM public.uniform_inventory
    WHERE id = v_item.inventory_id
    FOR UPDATE;

    IF v_inv_record IS NULL THEN
      RAISE EXCEPTION 'Item de estoque não encontrado para o ID: %', v_item.inventory_id;
    END IF;

    IF v_inv_record.quantity < v_item.qty THEN
      RAISE EXCEPTION 'Estoque insuficiente para % (Tamanho: %). Solicitado: %, Disponível: %', 
        v_inv_record.piece_type, v_inv_record.size, v_item.qty, v_inv_record.quantity;
    END IF;

    UPDATE public.uniform_inventory
    SET quantity = quantity - v_item.qty,
        updated_at = now()
    WHERE id = v_item.inventory_id;

    v_history_text := v_history_text || v_separator || 
                      v_item.qty::text || 'x ' || v_inv_record.piece_type || ' (' || v_inv_record.size || ')';
    v_separator := ', ';
  END LOOP;

  INSERT INTO public.uniforms (employee_id, delivery_date, items, size)
  VALUES (p_employee_id, p_delivery_date, v_history_text, 'Múltiplos');
END;
$$;
