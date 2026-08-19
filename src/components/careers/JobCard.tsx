import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, DollarSign, Accessibility, Users } from "lucide-react";
import Link from "next/link";
import type { Career } from "./types";
import { formatSalaryRange, timeAgo } from "./types";

export function JobCard({ career }: { career: Career }) {
  const salary = formatSalaryRange(career.salary_min, career.salary_max);
  const location = career.cost_center || career.department || "Área não informada";

  return (
    <div className="flex flex-col rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <h3 className="text-base font-semibold leading-snug">{career.profile?.title || "Vaga sem título"}</h3>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center"><MapPin className="mr-1 h-3.5 w-3.5" />{location}</span>
        {salary && <span className="inline-flex items-center"><DollarSign className="mr-1 h-3.5 w-3.5" />{salary}</span>}
        {career.is_pcd_eligible && <span className="inline-flex items-center"><Accessibility className="mr-1 h-3.5 w-3.5" />Elegível PCD</span>}
        {career.affirmative_tags.length > 0 && <span className="inline-flex items-center"><Users className="mr-1 h-3.5 w-3.5" />Vaga afirmativa</span>}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {career.work_mode && <Badge variant="secondary">{career.work_mode}</Badge>}
        {career.seniority && <Badge variant="secondary">{career.seniority}</Badge>}
      </div>

      <span className="mt-3 text-xs text-muted-foreground">{timeAgo(career.created_at)}</span>

      <Link href={`/carreiras/vaga?id=${career.id}`}>
        <Button className="mt-4 w-full">Ver Vaga</Button>
      </Link>
    </div>
  );
}
