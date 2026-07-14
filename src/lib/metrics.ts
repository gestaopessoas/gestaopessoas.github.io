export function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {})
}

export function groupCount<T>(rows: T[], key: keyof T): Record<string, number> {
  return countBy(rows.map((row) => String(row[key] ?? "Sem status")))
}
