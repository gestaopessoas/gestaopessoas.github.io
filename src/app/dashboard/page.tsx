import { redirect } from "next/navigation";

export default function DashboardPage() {
  // Redireciona temporariamente para a página de colaboradores até que a visão geral seja construída.
  redirect("/dashboard/colaboradores");
}
