import React from "react";
import { MafiaBackground } from "../core/ui/MafiaBackground";
import { motion } from "framer-motion";
import { useAuth } from "../core/auth/useAuth";
import { routes } from "../core/config/routes";

type Step = "phone" | "otp" | "profile";

export function AuthPage({ navigate }: { navigate: (path: string) => void }) {
  const auth = useAuth();
  const [step, setStep] = React.useState<Step>(() =>
    auth.status === "authenticated" ? "profile" : "phone"
  );
  const [phone, setPhone] = React.useState("");
  const [normalizedPhone, setNormalizedPhone] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [displayName, setDisplayName] = React.useState(
    auth.profile?.displayName === "Игрок" ? "" : auth.profile?.displayName ?? ""
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (auth.status === "authenticated" && auth.profile && auth.profile.displayName !== "Игрок") {
      navigate(routes.home);
    }
  }, [auth.profile, auth.status, navigate]);

  async function submitPhone() {
    await run(async () => {
      const cleanPhone = await auth.requestPhoneOtp(phone);
      setNormalizedPhone(cleanPhone);
      setStep("otp");
    });
  }

  async function submitOtp() {
    await run(async () => {
      await auth.verifyPhoneOtp(normalizedPhone || phone, otp);
      setStep("profile");
    });
  }

  async function submitProfile() {
    await run(async () => {
      await auth.saveDisplayName(displayName);
      navigate(routes.home);
    });
  }

  async function run(action: () => Promise<void>) {
    setIsSubmitting(true);
    setError("");
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось выполнить действие");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mafia-auth-shell">
      <MafiaBackground name="home" className="mafia-auth-vignette" />
      <motion.section
        className="mafia-auth-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mafia-wordmark" aria-label="Abdulkadyrov Games — Mafia">
          <span className="mafia-wordmark-kicker">Abdulkadyrov Games</span>
          <strong>MAFIA</strong>
          <span>Город засыпает. Игра начинается.</span>
        </div>

        {auth.status === "unconfigured" ? (
          <div className="mafia-auth-form" role="alert">
            <h1>Подключите игровой сервер</h1>
            <p>
              Для безопасной регистрации по телефону нужны переменные Supabase.
              Скопируйте шаблон окружения и укажите URL и publishable key проекта.
            </p>
            <div className="mafia-form-error">{auth.configurationError}</div>
          </div>
        ) : null}

        {auth.status !== "unconfigured" && step === "phone" ? (
          <form className="mafia-auth-form" onSubmit={(event) => { event.preventDefault(); void submitPhone(); }}>
            <p className="mafia-step-label">Шаг 1 из 3</p>
            <h1>Вход по телефону</h1>
            <p>Мы отправим одноразовый шестизначный код. Номер не увидят другие игроки.</p>
            <label>
              <span>Номер телефона</span>
              <input
                autoFocus
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+7 999 123-45-67"
              />
            </label>
            <button className="mafia-primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Отправляем…" : "Получить SMS-код"}
            </button>
          </form>
        ) : null}

        {auth.status !== "unconfigured" && step === "otp" ? (
          <form className="mafia-auth-form" onSubmit={(event) => { event.preventDefault(); void submitOtp(); }}>
            <p className="mafia-step-label">Шаг 2 из 3</p>
            <h1>Введите код</h1>
            <p>Код отправлен на {normalizedPhone}. Он действует ограниченное время.</p>
            <label>
              <span>SMS-код</span>
              <input
                autoFocus
                className="mafia-otp-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                placeholder="000000"
              />
            </label>
            <button className="mafia-primary-button" disabled={isSubmitting || otp.length !== 6} type="submit">
              {isSubmitting ? "Проверяем…" : "Подтвердить код"}
            </button>
            <button className="mafia-link-button" type="button" onClick={() => { setOtp(""); setStep("phone"); }}>
              Изменить номер
            </button>
          </form>
        ) : null}

        {auth.status !== "unconfigured" && step === "profile" ? (
          <form className="mafia-auth-form" onSubmit={(event) => { event.preventDefault(); void submitProfile(); }}>
            <p className="mafia-step-label">Шаг 3 из 3</p>
            <h1>Как вас называть?</h1>
            <p>Это имя увидят игроки в лобби, видеосетке и результатах партии.</p>
            <label>
              <span>Имя игрока</span>
              <input
                autoFocus
                autoComplete="nickname"
                maxLength={32}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Абдулкадыров"
              />
            </label>
            <button className="mafia-primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Сохраняем…" : "Войти в игру"}
            </button>
          </form>
        ) : null}

        {error ? <div className="mafia-form-error" role="alert">{error}</div> : null}
      </motion.section>
    </main>
  );
}
