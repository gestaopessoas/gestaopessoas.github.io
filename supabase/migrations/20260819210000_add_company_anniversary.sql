-- Add company_anniversary column
ALTER TABLE employees ADD COLUMN company_anniversary DATE;

-- Copy admission_date to company_anniversary for existing records
UPDATE employees SET company_anniversary = admission_date;
