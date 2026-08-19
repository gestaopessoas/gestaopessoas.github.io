const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/central-candidato/page.tsx', 'utf-8');

code = code.replace(
  '<CandidateProfileModal \r\n          candidateId={selectedCandidateId}',
  '<CandidateProfileModal \r\n          isEditable={canEdit}\r\n          candidateId={selectedCandidateId}'
);
code = code.replace(
  '<CandidateProfileModal \n          candidateId={selectedCandidateId}',
  '<CandidateProfileModal \n          isEditable={canEdit}\n          candidateId={selectedCandidateId}'
);

fs.writeFileSync('src/app/dashboard/central-candidato/page.tsx', code);
