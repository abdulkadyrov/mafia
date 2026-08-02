import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabase/client";
import type { AuthUser, UserProfile } from "./authTypes";

type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export function toAuthUser(user: User): AuthUser {
  return { id: user.id, phone: user.phone ?? "" };
}

export async function loadProfile(user: AuthUser): Promise<UserProfile | null> {
  const { data, error } = await getSupabaseClient()
    .from("profiles")
    .select("id, display_name, avatar_url, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error("Не удалось загрузить профиль");
  return data ? mapProfile(data as ProfileRow, user.phone) : null;
}

export async function updateDisplayName(user: AuthUser, rawName: string): Promise<UserProfile> {
  const displayName = rawName.replace(/\s+/g, " ").trim();
  if (displayName.length < 2 || displayName.length > 32) {
    throw new Error("Имя должно содержать от 2 до 32 символов");
  }
  const { data, error } = await getSupabaseClient()
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id)
    .select("id, display_name, avatar_url, created_at, updated_at")
    .single();
  if (error || !data) throw new Error("Не удалось сохранить имя");
  return mapProfile(data as ProfileRow, user.phone);
}

export async function uploadAvatar(user: AuthUser, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Выберите изображение");
  if (file.size > 2 * 1024 * 1024) throw new Error("Размер аватара не должен превышать 2 МБ");
  const extension = file.type === "image/avif" ? "avif" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/avatar.${extension}`;
  const client = getSupabaseClient();
  const { error: uploadError } = await client.storage.from("profile-avatars").upload(path, file, {
    upsert: true,
    cacheControl: "3600",
    contentType: file.type,
  });
  if (uploadError) throw new Error("Не удалось загрузить аватар");
  const { data } = client.storage.from("profile-avatars").getPublicUrl(path);
  const versionedUrl = `${data.publicUrl}?v=${Date.now()}`;
  const { error } = await client.from("profiles").update({ avatar_url: versionedUrl }).eq("id", user.id);
  if (error) throw new Error("Не удалось сохранить аватар");
  return versionedUrl;
}

export async function deleteAvatar(user: AuthUser, avatarUrl: string | null): Promise<void> {
  const client = getSupabaseClient();
  if (avatarUrl) {
    const marker = "/profile-avatars/";
    const index = avatarUrl.indexOf(marker);
    if (index >= 0) {
      const path = avatarUrl.slice(index + marker.length).split("?")[0];
      await client.storage.from("profile-avatars").remove([path]);
    }
  }
  const { error } = await client.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (error) throw new Error("Не удалось удалить аватар");
}

function mapProfile(row: ProfileRow, phone: string): UserProfile {
  return {
    id: row.id,
    phone,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
