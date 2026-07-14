type BarBreakdownProps = {
  data: { label: string; value: number }[]
  title?: string
}

export function BarBreakdown({ data, title }: BarBreakdownProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const max = sorted.reduce((m, row) => Math.max(m, row.value), 0)

  return (
    <div className="space-y-3">
      {title && <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>}
      {sorted.length === 0 && <p className="text-sm text-muted-foreground">Sem dados ainda.</p>}
      {sorted.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span>{row.label}</span>
            <span className="font-medium tabular-nums">{row.value}</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${max ? Math.max((row.value / max) * 100, 4) : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
