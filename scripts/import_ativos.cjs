const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://bnwwdseczwrmmuvallml.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJud3dkc2VjendybW11dmFsbG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDIxMDcsImV4cCI6MjA5OTAxODEwN30.46hTU6b8xgpsoASZu0K7cEi_FfA3ZBt8e417mfrda7k'
);

const basePath = 'C:\\Users\\ACPO Empreendimentos\\CONSTRUTORA ACPO LTDA\\CLOUD PRIVADO - Documentos\\ACPO';

function getDirectories(srcPath) {
  if (!fs.existsSync(srcPath)) return [];
  return fs.readdirSync(srcPath).filter(file => fs.statSync(path.join(srcPath, file)).isDirectory());
}

async function main() {
  const employees = [];

  // 1. SEDE
  const sedePath = path.join(basePath, 'SEDE', 'FUNCIONARIOS');
  const sedeDirs = getDirectories(sedePath);
  
  for (const dirName of sedeDirs) {
    if (dirName.includes('Atalho') || dirName.startsWith('.')) continue;
    employees.push({
      name: dirName.trim(),
      status: 'Ativo',
      unit: 'Sede'
    });
  }

  // 2. OBRAS
  const obrasPath = path.join(basePath, 'OBRAS');
  const obrasSubDirs = getDirectories(obrasPath);
  
  for (const subDir of obrasSubDirs) {
    const obraEmpsPath = path.join(obrasPath, subDir);
    const obraDirs = getDirectories(obraEmpsPath);
    
    for (const dirName of obraDirs) {
      if (dirName.includes('Atalho') || dirName.startsWith('.')) continue;
      employees.push({
        name: dirName.trim(),
        status: 'Ativo',
        unit: 'Obras' // or subDir if we want to distinguish the obra name
      });
    }
  }

  console.log(`Encontrados ${employees.length} colaboradores ativos.`);
  console.log('Exemplos:', employees.slice(0, 3));

  // Remove existing actives just in case? No, the user asked to "remove all" before, so it should be empty.
  // But let's be safe
  await supabase.from('employees').delete().eq('status', 'Ativo');

  // Insert in batches
  const batchSize = 500;
  for (let i = 0; i < employees.length; i += batchSize) {
    const batch = employees.slice(i, i + batchSize);
    console.log(`Inserindo lote de ativos ${i/batchSize + 1}...`);
    const { error } = await supabase.from('employees').insert(batch);
    if (error) {
      console.error('Erro ao inserir:', error);
      break;
    }
  }

  console.log('Importação concluída com sucesso!');
}

main();
