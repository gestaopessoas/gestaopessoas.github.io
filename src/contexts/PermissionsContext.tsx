"use client";

import { createContext, useEffect, useState, ReactNode } from "react";
import { createClient } from "@/utils/supabase/client";

type Permissions = Record<string, Record<string, boolean>>;

interface PermissionsContextData {
  loading: boolean;
  level: number;
  permissions: Permissions;
  can: (module: string, action?: string) => boolean;
}

export const PermissionsContext = createContext<PermissionsContextData>({
  loading: true,
  level: 0,
  permissions: {},
  can: () => false,
});

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState(0);
  const [permissions, setPermissions] = useState<Permissions>({});

  useEffect(() => {
    let active = true;

    const load = async () => {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!user) {
        if (active) setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("level, profile_permissions(module_key, action_key, allowed)")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;
      setLevel(data?.level ?? 0);
      const mappedPermissions: Permissions = {};
      for (const permission of data?.profile_permissions ?? []) {
        const item = permission as { module_key: string; action_key: string; allowed: boolean };
        mappedPermissions[item.module_key] ??= {};
        mappedPermissions[item.module_key][item.action_key] = item.allowed;
      }
      setPermissions(mappedPermissions);
      setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const can = (module: string, action: string = "view") => {
    if (level >= 50) return true;
    return permissions?.[module]?.[action] === true;
  };

  return (
    <PermissionsContext.Provider value={{ loading, level, permissions, can }}>
      {children}
    </PermissionsContext.Provider>
  );
}
