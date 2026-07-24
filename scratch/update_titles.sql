-- Standardize employees names
UPDATE employees SET name = initcap(regexp_replace(name, '\s+', ' ', 'g'));
UPDATE employees SET name = replace(name, ' Da ', ' da ') WHERE name LIKE '% Da %';
UPDATE employees SET name = replace(name, ' De ', ' de ') WHERE name LIKE '% De %';
UPDATE employees SET name = replace(name, ' Do ', ' do ') WHERE name LIKE '% Do %';
UPDATE employees SET name = replace(name, ' Das ', ' das ') WHERE name LIKE '% Das %';
UPDATE employees SET name = replace(name, ' Dos ', ' dos ') WHERE name LIKE '% Dos %';
UPDATE employees SET name = replace(name, ' E ', ' e ') WHERE name LIKE '% E %';

-- Standardize job_profiles
UPDATE job_profiles SET title = initcap(regexp_replace(title, '\s+', ' ', 'g'));
UPDATE job_profiles SET title = replace(title, ' Da ', ' da ') WHERE title LIKE '% Da %';
UPDATE job_profiles SET title = replace(title, ' De ', ' de ') WHERE title LIKE '% De %';
UPDATE job_profiles SET title = replace(title, ' Do ', ' do ') WHERE title LIKE '% Do %';
UPDATE job_profiles SET title = replace(title, ' Das ', ' das ') WHERE title LIKE '% Das %';
UPDATE job_profiles SET title = replace(title, ' Dos ', ' dos ') WHERE title LIKE '% Dos %';
UPDATE job_profiles SET title = replace(title, ' E ', ' e ') WHERE title LIKE '% E %';

-- Standardize departments
UPDATE departments SET name = initcap(regexp_replace(name, '\s+', ' ', 'g'));
UPDATE departments SET name = replace(name, ' Da ', ' da ') WHERE name LIKE '% Da %';
UPDATE departments SET name = replace(name, ' De ', ' de ') WHERE name LIKE '% De %';
UPDATE departments SET name = replace(name, ' Do ', ' do ') WHERE name LIKE '% Do %';
UPDATE departments SET name = replace(name, ' Das ', ' das ') WHERE name LIKE '% Das %';
UPDATE departments SET name = replace(name, ' Dos ', ' dos ') WHERE name LIKE '% Dos %';
UPDATE departments SET name = replace(name, ' E ', ' e ') WHERE name LIKE '% E %';

-- Clean up any trailing/leading spaces
UPDATE employees SET name = trim(name);
UPDATE job_profiles SET title = trim(title);
UPDATE departments SET name = trim(name);
