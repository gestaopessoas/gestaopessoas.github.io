const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/central-candidato/page.tsx', 'utf-8');

code = code.replace(
  'const canDelete = can("central_candidato", "delete");',
  'const canDelete = can("central_candidato", "delete");\n  const canEdit = can("central_candidato", "edit");'
);

code = code.replace(
  '<CandidateProfileModal \n          candidateId={selectedCandidateId}',
  '<CandidateProfileModal \n          isEditable={canEdit}\n          candidateId={selectedCandidateId}'
);

fs.writeFileSync('src/app/dashboard/central-candidato/page.tsx', code);
