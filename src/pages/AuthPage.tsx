import React from "react";
import { motion } from "framer-motion";
import { loginWithCredentials } from "../core/auth/authStorage";
import { appConfig } from "../core/config/appConfig";
import { routes } from "../core/config/routes";
import { Button } from "../core/ui/Button";
import { Card } from "../core/ui/Card";
import { Input } from "../core/ui/Input";

export function AuthPage({
  navigate,
  onSuccess,
}: {
  navigate: (path: string) => void;
  onSuccess: () => void;
}) {
  const [login, setLogin] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState("");

  function handleSubmit() {
    if (!loginWithCredentials(login, password)) {
      setErrorMessage("Неверный логин или пароль");
      return;
    }

    setErrorMessage("");
    onSuccess();
    navigate(routes.home);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#16324f_0%,#07111f_40%,#020617_100%)] px-4 py-5 text-white">
      <div className="mx-auto grid min-h-[calc(100dvh-2.5rem)] max-w-3xl gap-5 place-items-center">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-xl space-y-4"
        >
          <Card>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200/80">
              {appConfig.appName}
            </p>
            <h1 className="mt-4 text-4xl font-black sm:text-5xl">
              Вход в платформу
            </h1>
            <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-white/72">
              Сначала авторизация, потом главное меню, игры и настройки. Внутренние
              игровые комнаты продолжат работать отдельно.
            </p>
            <div className="mt-6">
              <label className="block">
                <span className="mb-2 block text-sm font-black uppercase tracking-[0.16em] text-white/55">
                  Логин
                </span>
                <Input
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                  placeholder="Логин"
                  autoComplete="username"
                />
              </label>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-black uppercase tracking-[0.16em] text-white/55">
                  Пароль / код
                </span>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Пароль"
                  autoComplete="current-password"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSubmit();
                    }
                  }}
                />
              </label>

              <div className="mt-5">
                <Button variant="primary" onClick={handleSubmit}>
                  Войти
                </Button>
              </div>

              {errorMessage ? (
                <p className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
                  {errorMessage}
                </p>
              ) : null}
            </div>
          </Card>
        </motion.section>
      </div>
    </main>
  );
}
