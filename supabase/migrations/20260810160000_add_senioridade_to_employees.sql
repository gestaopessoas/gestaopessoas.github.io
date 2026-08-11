-- Add senioridade field to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS senioridade text;
