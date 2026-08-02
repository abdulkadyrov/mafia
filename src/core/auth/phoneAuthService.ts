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

export async function requestPhoneOtp(rawPhone: string): Promise<string> {
  const phone = normalizePhone(rawPhone);
  const { error } = await getSupabaseClient().auth.signInWithOtp({ phone });
  if (error) throw mapAuthError(error.message);
  return phone;
}

export async function verifyPhoneOtp(rawPhone: string, token: string): Promise<void> {
  const phone = normalizePhone(rawPhone);
  const cleanToken = token.replace(/\D/g, "");
  if (cleanToken.length !== 6) throw new Error("Введите шестизначный код из SMS");
  const { error } = await getSupabaseClient().auth.verifyOtp({ phone, token: cleanToken, type: "sms" });
  if (error) throw mapAuthError(error.message);
}

function mapAuthError(message: string): Error {
  const normalized = message.toLowerCase();
  if (normalized.includes("rate") || normalized.includes("seconds")) {
    return new Error("Код уже отправлен. Подождите перед повторной попыткой");
  }
  if (normalized.includes("expired")) return new Error("Код истёк. Запросите новый");
  if (normalized.includes("invalid")) return new Error("Неверный SMS-код");
  return new Error("Не удалось выполнить вход по телефону");
}
