const fs = require('fs');
let code = fs.readFileSync('C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/b450d075-f0a6-4f6d-b3c8-eb02f186e861/task.md', 'utf8');
code = code.replace('- [ ] Atualizar CandidateProfileModal.tsx para carregar candidate_interviews', '- [x] Atualizar CandidateProfileModal.tsx para carregar candidate_interviews');
code = code.replace('- [ ] Adicionar aba "Histórico" no CandidateProfileModal.tsx e migrar a renderização da linha do tempo', '- [x] Adicionar aba "Histórico" no CandidateProfileModal.tsx e migrar a renderização da linha do tempo');
fs.writeFileSync('C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/b450d075-f0a6-4f6d-b3c8-eb02f186e861/task.md', code);
