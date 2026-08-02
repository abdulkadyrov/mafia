import { getSupabaseClient } from "../supabase/client";

export function normalizePhone(rawPhone: string): string {
  const value = rawPhone.trim().replace(/[\s()-]/g, "");
  const normalized = value.startsWith("8") && value.length === 11
    ? `+7${value.slice(1)}`
    : value.startsWith("+")
      ? value
      : `+${value}`;
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error("Введите номер в международном формате, например +7 999 123-45-67");
  }
  return normalized;
}

export function validatePassword(password: string): void {
  if (password.length < 6) throw new Error("Пароль должен содержать минимум 6 символов");
}

export async function signInWithPhonePassword(rawPhone: string, password: string): Promise<string> {
  const phone = normalizePhone(rawPhone);
  validatePassword(password);
  const { error } = await getSupabaseClient().auth.signInWithPassword({ phone, password });
  if (error) throw mapAuthError(error.message, "sign-in");
  return phone;
}

export async function signUpWithPhonePassword(rawPhone: string, password: string): Promise<string> {
  const phone = normalizePhone(rawPhone);
  validatePassword(password);
  const { data, error } = await getSupabaseClient().auth.signUp({ phone, password });
  if (error) throw mapAuthError(error.message, "sign-up");
  if (!data.session) {
    throw new Error("В Supabase включено подтверждение телефона. Отключите Phone Confirmations");
  }
  return phone;
}

function mapAuthError(message: string, operation: "sign-in" | "sign-up"): Error {
  const normalized = message.toLowerCase();
  if (normalized.includes("already") || normalized.includes("registered")) {
    return new Error("Аккаунт с этим номером уже существует. Выполните вход");
  }
  if (normalized.includes("invalid login") || normalized.includes("credentials")) {
    return new Error("Неверный номер телефона или пароль");
  }
  if (normalized.includes("password")) {
    return new Error("Пароль должен содержать минимум 6 символов");
  }
  if (normalized.includes("phone") && normalized.includes("disabled")) {
    return new Error("Вход по телефону отключён в настройках Supabase");
  }
  return new Error(operation === "sign-in" ? "Не удалось выполнить вход" : "Не удалось создать аккаунт");
}
