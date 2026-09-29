"use client"

import { useState } from "react"
import { X, Plus, Trash2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export type TagGroup = { category: string; tags: string[] }

type Props = {
  /** null = ainda carregando */
  groups: TagGroup[] | null
  onChange: (groups: TagGroup[]) => void
  itemLabel?: string
}

// Editor de opções agrupadas por categoria (tags de busca da vaga, opções do parecer).
export function TagGroupsEditor({ groups, onChange, itemLabel = "tag" }: Props) {
  const [newTag, setNewTag] = useState<Record<string, string>>({})
  const [newCategory, setNewCategory] = useState("")

  if (groups === null) return <p className="text-sm text-muted-foreground">Carregando...</p>

  function updateGroup(category: string, change: (group: TagGroup) => TagGroup | null) {
    onChange((groups ?? []).flatMap(group => {
      if (group.category !== category) return [group]
      const next = change(group)
      return next ? [next] : []
    }))
  }

  function addTag(category: string) {
    const tag = (newTag[category] ?? "").trim()
    if (!tag) return
    if (groups?.some(group => group.tags.includes(tag))) return alert(`"${tag}" já existe.`)
    updateGroup(category, group => ({ ...group, tags: [...group.tags, tag] }))
    setNewTag(prev => ({ ...prev, [category]: "" }))
  }

  function renameCategory(category: string) {
    const name = prompt("Novo nome da categoria:", category)?.trim()
    if (!name || name === category) return
    if (groups?.some(group => group.category === name)) return alert(`A categoria "${name}" já existe.`)
    updateGroup(category, group => ({ ...group, category: name }))
  }

  function removeCategory(group: TagGroup) {
    if (!confirm(`Apagar a categoria "${group.category}" e suas ${group.tags.length} opções?`)) return
    updateGroup(group.category, () => null)
  }

  function addCategory() {
    const name = newCategory.trim()
    if (!name) return
    if (groups?.some(group => group.category === name)) return alert(`A categoria "${name}" já existe.`)
    onChange([...(groups ?? []), { category: name, tags: [] }])
    setNewCategory("")
  }

  return (
    <>
      {groups.map(group => (
        <div key={group.category} className="space-y-2 border-b border-border/40 pb-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-semibold">{group.category}</Label>
            <span className="text-xs text-muted-foreground">{group.tags.length}</span>
            <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => renameCategory(group.category)}>Renomear</Button>
            <Button type="button" variant="ghost" size="icon-sm" title="Apagar categoria" aria-label={`Apagar categoria ${group.category}`} onClick={() => removeCategory(group)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {group.tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 py-1 pl-3 pr-1 text-xs">
                {tag}
                <button type="button" className="rounded-full p-0.5 hover:bg-muted" title={`Remover ${tag}`} aria-label={`Remover ${tag}`}
                  onClick={() => updateGroup(group.category, g => ({ ...g, tags: g.tags.filter(t => t !== tag) }))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex max-w-sm gap-2">
            <Input className="h-8 text-sm" placeholder={`Nova ${itemLabel}`} maxLength={80} value={newTag[group.category] ?? ""}
              onChange={e => setNewTag(prev => ({ ...prev, [group.category]: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(group.category) } }} />
            <Button type="button" variant="outline" size="sm" className="h-8" aria-label={`Adicionar em ${group.category}`} onClick={() => addTag(group.category)}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
      ))}
      <div className="flex max-w-sm gap-2">
        <Input className="h-8 text-sm" placeholder="Nova categoria" maxLength={60} value={newCategory}
          onChange={e => setNewCategory(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCategory() } }} />
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={addCategory}><Plus className="h-4 w-4 mr-1" />Categoria</Button>
      </div>
    </>
  )
}
