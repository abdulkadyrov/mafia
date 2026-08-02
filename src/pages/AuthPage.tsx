import React from "react";
import { MafiaBackground } from "../core/ui/MafiaBackground";
import { motion } from "framer-motion";
import { useAuth } from "../core/auth/useAuth";
import { routes } from "../core/config/routes";

type Step = "credentials" | "profile";
type AuthMode = "sign-in" | "sign-up";

export function AuthPage({ navigate }: { navigate: (path: string) => void }) {
  const auth = useAuth();
  const [step, setStep] = React.useState<Step>(() =>
    auth.status === "authenticated" ? "profile" : "credentials"
  );
  const [mode, setMode] = React.useState<AuthMode>("sign-in");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
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

  async function submitCredentials() {
    await run(async () => {
      const cleanPhone = mode === "sign-in"
        ? await auth.signInWithPhonePassword(phone, password)
        : await auth.signUpWithPhonePassword(phone, password);
      setPhone(cleanPhone);
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

        {auth.status !== "unconfigured" && step === "credentials" ? (
          <form className="mafia-auth-form" onSubmit={(event) => { event.preventDefault(); void submitCredentials(); }}>
            <p className="mafia-step-label">Без SMS и подтверждений</p>
            <h1>{mode === "sign-in" ? "Вход в игру" : "Создать аккаунт"}</h1>
            <p>Введите номер телефона и пароль. Номер не увидят другие игроки.</p>
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
            <label>
              <span>Пароль</span>
              <input
                type="password"
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Минимум 6 символов"
              />
            </label>
            <button className="mafia-primary-button" disabled={isSubmitting || password.length < 6} type="submit">
              {isSubmitting
                ? mode === "sign-in" ? "Входим…" : "Создаём…"
                : mode === "sign-in" ? "Войти" : "Создать аккаунт"}
            </button>
            <button
              className="mafia-link-button"
              type="button"
              onClick={() => {
                setError("");
                setMode((current) => current === "sign-in" ? "sign-up" : "sign-in");
              }}
            >
              {mode === "sign-in" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
            </button>
          </form>
        ) : null}

        {auth.status !== "unconfigured" && step === "profile" ? (
          <form className="mafia-auth-form" onSubmit={(event) => { event.preventDefault(); void submitProfile(); }}>
            <p className="mafia-step-label">Профиль игрока</p>
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
