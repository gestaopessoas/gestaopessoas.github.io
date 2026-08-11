-- Drop the existing foreign key constraint if it exists
ALTER TABLE financial_snapshot_details
DROP CONSTRAINT IF EXISTS financial_snapshot_details_employee_id_fkey;

-- Re-create the foreign key constraint with ON DELETE CASCADE
ALTER TABLE financial_snapshot_details
ADD CONSTRAINT financial_snapshot_details_employee_id_fkey
FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
