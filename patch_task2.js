const fs = require('fs');
let code = fs.readFileSync('C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/b450d075-f0a6-4f6d-b3c8-eb02f186e861/task.md', 'utf8');
code = code.replace('- [ ] Atualizar Central do Candidato (page.tsx) para abrir o CandidateProfileModal ao invés do Sheet', '- [x] Atualizar Central do Candidato (page.tsx) para abrir o CandidateProfileModal ao invés do Sheet');
fs.writeFileSync('C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/b450d075-f0a6-4f6d-b3c8-eb02f186e861/task.md', code);
