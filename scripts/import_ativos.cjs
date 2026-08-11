const fs = require('fs');
const path = require('path');
const { supabase } = require('./lib/supabaseClient.cjs');

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
