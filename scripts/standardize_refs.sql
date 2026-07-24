-- Standardize departments table
UPDATE departments SET name = initcap(trim(name));

-- Standardize job_profiles table (assuming title is the field)
UPDATE job_profiles SET title = initcap(trim(title));

-- Standardize cost_centers table
UPDATE cost_centers SET name = initcap(trim(name));

-- Standardize workplaces table
UPDATE workplaces SET name = initcap(trim(name));
