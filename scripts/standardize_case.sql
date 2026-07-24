UPDATE employees SET 
  name = initcap(trim(name)),
  role = initcap(trim(role)),
  workplace = initcap(trim(workplace)),
  unit = initcap(trim(unit)),
  cost_center = initcap(trim(cost_center));
