export function generateStaticParams() {
  return [
    { id: "req-042" },
    { id: "req-043" },
    { id: "req-044" },
    { id: "req-040" },
    { id: "req-039" },
  ]
}

export default function KanbanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
