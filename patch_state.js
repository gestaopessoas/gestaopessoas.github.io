const fs = require('fs');
let code = fs.readFileSync('src/components/CandidateProfileModal.tsx', 'utf8');

const target1 = \	ype ProfileInterview = {\;
const replacement1 = \	ype CandidateInterview = {
  id: string;
  candidate_id: string;
  stage: string;
  workplace_name?: string | null;
  interviewer_name?: string | null;
  created_at: string;
  notes?: string | null;
  rejection_reason?: string | null;
};

type ProfileInterview = {\;
code = code.replace(target1, replacement1);

const target2 = \  const [activeTab, setActiveTab] = useState<"curriculum" | "behavioral">(initialTab);\;
const replacement2 = \  const [activeTab, setActiveTab] = useState<"curriculum" | "behavioral" | "history">(initialTab);\;
code = code.replace(target2, replacement2);

const target3 = \  const [interviews, setInterviews] = useState<ProfileInterview[]>([]);\;
const replacement3 = \  const [interviews, setInterviews] = useState<ProfileInterview[]>([]);
  const [candidateInterviews, setCandidateInterviews] = useState<CandidateInterview[]>([]);\;
code = code.replace(target3, replacement3);

const target4 = \let interviewsData: ProfileInterview[] = [];\;
const replacement4 = \let interviewsData: ProfileInterview[] = [];
        let candidateInterviewsData: CandidateInterview[] = [];\;
code = code.replace(target4, replacement4);

const target5 = \// 3. Buscar formações (candidate_educations)\;
const replacement5 = \// Buscar histórico de etapas (candidate_interviews)
        if (targetCandId) {
          const { data } = await supabase.from("candidate_interviews").select("*").eq("candidate_id", targetCandId).order("created_at", { ascending: false });
          if (data) candidateInterviewsData = data;
        }
        
        // 3. Buscar formações (candidate_educations)\;
code = code.replace(target5, replacement5);

const target6 = \setInterviews(interviewsData);\;
const replacement6 = \setInterviews(interviewsData);
        setCandidateInterviews(candidateInterviewsData);\;
code = code.replace(target6, replacement6);

fs.writeFileSync('src/components/CandidateProfileModal.tsx', code);
