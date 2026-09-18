"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApplicationDialog } from "./ApplicationDialog";
import { fetchTalentPoolJob } from "./talentPool";
import type { Career } from "./types";

// A home é server component; o botão precisa de estado (o id do pool vem por RPC no
// cliente) e do modal, então mora aqui.
export function TalentPoolButton() {
  const [job, setJob] = useState<Career | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchTalentPoolJob().then(setJob);
  }, []);

  if (!job) return null;

  return (
    <>
      <Button
        size="lg"
        variant="ghost"
        className="font-semibold text-muted-foreground hover:text-foreground transition-all"
        onClick={() => setOpen(true)}
      >
        Candidatar-se como Talento ACPO
      </Button>
      <ApplicationDialog job={job} open={open} onOpenChange={setOpen} />
    </>
  );
}
