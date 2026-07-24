const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read env variables
const envPath = path.join(__dirname, '.env');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (e) {
  console.error('Could not read .env', e);
  process.exit(1);
}

let supabaseUrl = '';
let supabaseKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

const prepositions = ['de', 'do', 'da', 'dos', 'das', 'e', 'em', 'para', 'com', 'sem', 'por', 'a', 'o', 'as', 'os', 'no', 'na', 'nos', 'nas'];
const acronyms = ['SMS', 'RH', 'TI', 'DP', 'QSMRS', 'SGQ', 'CEO', 'CFO', 'CTO'];

function standardizeTitle(text) {
  if (!text) return text;
  
  // Convert everything to lowercase first
  let result = text.toLowerCase();
  
  // Split into words
  let words = result.split(/(\s+|-|\/)/);
  
  for (let i = 0; i < words.length; i++) {
    let word = words[i];
    if (!word.trim() || word === '-' || word === '/') continue; // skip spaces and separators
    
    // Check for acronyms
    let upperWord = word.toUpperCase();
    if (acronyms.includes(upperWord)) {
      words[i] = upperWord;
      continue;
    }
    
    // Check for prepositions (only lowercase them if they are not the first word)
    // We determine "first word" loosely by looking if there's any non-space before it
    let isFirstWord = true;
    for (let j = 0; j < i; j++) {
      if (words[j].trim() && words[j] !== '-' && words[j] !== '/') {
        isFirstWord = false;
        break;
      }
    }
    
    if (!isFirstWord && prepositions.includes(word)) {
      words[i] = word.toLowerCase();
      continue;
    }
    
    // Capitalize first letter
    if (word.length > 0) {
      // Handle parentheses like "(a)" or "(as)"
      if (word.startsWith('(') && word.endsWith(')')) {
          let inner = word.substring(1, word.length - 1);
          if (['a', 'as', 'o', 'os'].includes(inner)) {
              words[i] = '(' + inner.toLowerCase() + ')';
          } else {
              words[i] = '(' + inner.charAt(0).toUpperCase() + inner.slice(1) + ')';
          }
      } else {
          // Normal word capitalization
          // But wait, there might be a parenthesis attached to the word like "Diretor(a)"
          let parts = word.split('(');
          if (parts.length > 1) {
             let base = parts[0];
             let suffix = '(' + parts.slice(1).join('('); // Keep the rest
             let capitalizedBase = base.charAt(0).toUpperCase() + base.slice(1);
             // lowercase the suffix if it's (a) etc
             if (suffix.toLowerCase() === '(a)' || suffix.toLowerCase() === '(as)' || suffix.toLowerCase() === '(o)' || suffix.toLowerCase() === '(os)') {
                 words[i] = capitalizedBase + suffix.toLowerCase();
             } else {
                 words[i] = capitalizedBase + suffix.toLowerCase(); // Just lowercase for simplicity unless it's a specific acronym inside
             }
          } else {
              words[i] = word.charAt(0).toUpperCase() + word.slice(1);
          }
      }
    }
  }
  
  // Join back
  let finalStr = words.join('');
  
  // Clean up any double spaces
  finalStr = finalStr.replace(/\s+/g, ' ').trim();
  
  return finalStr;
}

async function run() {
  console.log('Starting standardization...');
  
  // 1. Update roles in employees table
  const { data: employees, error: empErr } = await supabase.from('employees').select('id, role');
  if (empErr) {
    console.error('Error fetching employees:', empErr);
    return;
  }
  
  let empUpdated = 0;
  for (const emp of employees) {
    if (!emp.role) continue;
    const stdRole = standardizeTitle(emp.role);
    if (stdRole !== emp.role) {
      await supabase.from('employees').update({ role: stdRole }).eq('id', emp.id);
      empUpdated++;
      console.log(`Employee role: "${emp.role}" -> "${stdRole}"`);
    }
  }
  
  // 2. Update departments
  const { data: depts, error: depErr } = await supabase.from('departments').select('id, name');
  if (depErr) {
    console.error('Error fetching departments:', depErr);
    return;
  }
  
  let depUpdated = 0;
  for (const dep of depts) {
    if (!dep.name) continue;
    const stdName = standardizeTitle(dep.name);
    if (stdName !== dep.name) {
      await supabase.from('departments').update({ name: stdName }).eq('id', dep.id);
      depUpdated++;
      console.log(`Department: "${dep.name}" -> "${stdName}"`);
    }
  }
  
  console.log(`Standardization complete. Employees updated: ${empUpdated}, Departments updated: ${depUpdated}`);
}

run();
