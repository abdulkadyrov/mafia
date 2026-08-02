import React from "react";
import { getSupabaseConfigError, isSupabaseConfigured, supabase } from "../supabase/client";
import type { AuthContextValue, AuthUser, UserProfile } from "./authTypes";
import { deleteAvatar, loadProfile, toAuthUser, updateDisplayName, uploadAvatar } from "./authService";
import {
  normalizePhone,
  signInWithPhonePassword,
  signUpWithPhonePassword,
  validatePassword,
} from "./phonePasswordAuthService";

const AuthContext = React.createContext<AuthContextValue | null>(null);
const DEV_SESSION_KEY = "mafia-dev-auth-session";
const devAuthEnabled = import.meta.env.DEV && import.meta.env.VITE_MAFIA_DEV_AUTH === "true";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<AuthContextValue["status"]>("loading");
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);

  const applyUser = React.useCallback(async (nextUser: AuthUser | null) => {
    setUser(nextUser);
    if (!nextUser) {
      setProfile(null);
      setStatus(isSupabaseConfigured() || devAuthEnabled ? "unauthenticated" : "unconfigured");
      return;
    }
    setStatus("authenticated");
    if (devAuthEnabled && nextUser.id === "00000000-0000-4000-8000-000000000001") {
      const stored = readDevProfile(nextUser);
      setProfile(stored);
      return;
    }
    try {
      setProfile(await loadProfile(nextUser));
    } catch {
      setProfile(null);
    }
  }, []);

  React.useEffect(() => {
    if (devAuthEnabled) {
      const stored = window.localStorage.getItem(DEV_SESSION_KEY);
      if (stored) void applyUser(JSON.parse(stored) as AuthUser);
      else setStatus("unauthenticated");
      return undefined;
    }
    if (!supabase) {
      setStatus("unconfigured");
      return undefined;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) void applyUser(data.session?.user ? toAuthUser(data.session.user) : null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) void applyUser(session?.user ? toAuthUser(session.user) : null);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [applyUser]);

  const value = React.useMemo<AuthContextValue>(() => ({
    status,
    user,
    profile,
    configurationError: status === "unconfigured" ? getSupabaseConfigError() : null,
    signInWithPhonePassword: async (rawPhone, password) => {
      const phone = normalizePhone(rawPhone);
      validatePassword(password);
      if (devAuthEnabled) {
        const nextUser = { id: "00000000-0000-4000-8000-000000000001", phone };
        window.localStorage.setItem(DEV_SESSION_KEY, JSON.stringify(nextUser));
        await applyUser(nextUser);
        return phone;
      }
      return signInWithPhonePassword(phone, password);
    },
    signUpWithPhonePassword: async (rawPhone, password) => {
      const phone = normalizePhone(rawPhone);
      validatePassword(password);
      if (devAuthEnabled) {
        const nextUser = { id: "00000000-0000-4000-8000-000000000001", phone };
        window.localStorage.setItem(DEV_SESSION_KEY, JSON.stringify(nextUser));
        await applyUser(nextUser);
        return phone;
      }
      return signUpWithPhonePassword(phone, password);
    },
    saveDisplayName: async (displayName) => {
      if (!user) throw new Error("Войдите в аккаунт");
      if (devAuthEnabled) {
        const clean = displayName.trim();
        if (clean.length < 2 || clean.length > 32) throw new Error("Имя должно содержать от 2 до 32 символов");
        const nextProfile = createDevProfile(user, clean);
        window.localStorage.setItem(`${DEV_SESSION_KEY}:profile`, JSON.stringify(nextProfile));
        setProfile(nextProfile);
        return;
      }
      setProfile(await updateDisplayName(user, displayName));
    },
    updateAvatar: async (file) => {
      if (!user || devAuthEnabled) throw new Error("Загрузка аватара доступна после подключения Supabase");
      const url = await uploadAvatar(user, file);
      setProfile((current) => current ? { ...current, avatarUrl: url } : current);
      return url;
    },
    removeAvatar: async () => {
      if (!user) return;
      if (!devAuthEnabled) await deleteAvatar(user, profile?.avatarUrl ?? null);
      setProfile((current) => current ? { ...current, avatarUrl: null } : current);
    },
    signOut: async () => {
      if (devAuthEnabled) {
        window.localStorage.removeItem(DEV_SESSION_KEY);
      } else if (supabase) {
        await supabase.auth.signOut();
      }
      await applyUser(null);
    },
    refreshProfile: async () => {
      if (!user) return;
      if (devAuthEnabled) setProfile(readDevProfile(user));
      else setProfile(await loadProfile(user));
    },
  }), [applyUser, profile, status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const value = React.useContext(AuthContext);
  if (!value) throw new Error("useAuth должен использоваться внутри AuthProvider");
  return value;
}

function readDevProfile(user: AuthUser): UserProfile {
  const raw = window.localStorage.getItem(`${DEV_SESSION_KEY}:profile`);
  return raw ? JSON.parse(raw) as UserProfile : createDevProfile(user, "Игрок");
}

function createDevProfile(user: AuthUser, displayName: string): UserProfile {
  const now = new Date().toISOString();
  return { id: user.id, phone: user.phone, displayName, avatarUrl: null, createdAt: now, updatedAt: now };
}
