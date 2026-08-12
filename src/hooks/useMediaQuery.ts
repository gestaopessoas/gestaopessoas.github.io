"use client"

import { useCallback, useSyncExternalStore } from "react"

/**
 * `matchMedia` é uma store externa do browser — ler por useSyncExternalStore evita
 * o par useState+useEffect (que renderizava uma vez com o valor errado) e é seguro
 * na hidratação: no servidor não existe viewport, então o snapshot é `false`.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const media = window.matchMedia(query)
      media.addEventListener("change", onStoreChange)
      return () => media.removeEventListener("change", onStoreChange)
    },
    [query]
  )

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
