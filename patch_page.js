const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/central-candidato/page.tsx', 'utf8');

const target1 = \import CandidateDetailsSheet from "./components/CandidateDetailsSheet";\;
const replacement1 = \import { CandidateProfileModal } from "@/components/CandidateProfileModal";\;
code = code.replace(target1, replacement1);

const target2 = \<CandidateDetailsSheet 
        candidateId={selectedCandidateId} 
        onClose={() => setSelectedCandidateId(null)} 
        onRefresh={fetchCandidates}
      />\;
const replacement2 = \{selectedCandidateId && (
        <CandidateProfileModal 
          candidateId={selectedCandidateId} 
          onClose={() => {
            setSelectedCandidateId(null);
            fetchCandidates();
          }} 
        />
      )}\;
code = code.replace(target2, replacement2);

fs.writeFileSync('src/app/dashboard/central-candidato/page.tsx', code);
