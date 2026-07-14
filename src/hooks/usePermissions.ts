"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"

type Permissions = Record<string, Record<string, boolean>>

export function usePermissions() {
  const [loading, setLoading] = useState(true)
  const [level, setLevel] = useState(0)
  const [permissions, setPermissions] = useState<Permissions>({})

  useEffect(() => {
    let active = true

    const load = async () => {
      const supabase = createClient()
      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user

      if (!user) {
        if (active) setLoading(false)
        return
      }

      const { data } = await supabase
        .from("profiles")
        .select("level, permissions")
        .eq("id", user.id)
        .single()

      if (!active) return
      setLevel(data?.level ?? 0)
      setPermissions((data?.permissions as Permissions) ?? {})
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const can = (module: string, action: string = "view") => {
    if (level >= 50) return true
    return permissions?.[module]?.[action] === true
  }

  return { loading, level, can }
}
