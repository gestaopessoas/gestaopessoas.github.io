const fs = require('fs');
let code = fs.readFileSync('src/components/CandidateProfileModal.tsx', 'utf8');

const target1 = \  initialTab?: "curriculum" | "behavioral";\;
const replacement1 = \  initialTab?: "curriculum" | "behavioral" | "history";\;
code = code.replace(target1, replacement1);

const target2 = \  const [activeTab, setActiveTab] = useState<"curriculum" | "behavioral">(initialTab || "curriculum");\;
const replacement2 = \  const [activeTab, setActiveTab] = useState<"curriculum" | "behavioral" | "history">(initialTab || "curriculum");\;
code = code.replace(target2, replacement2);

fs.writeFileSync('src/components/CandidateProfileModal.tsx', code);
