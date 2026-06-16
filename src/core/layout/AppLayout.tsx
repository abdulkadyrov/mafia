import { appConfig } from "../config/appConfig";
import { FloatingBackButton } from "./FloatingBackButton";

export function AppLayout({
  title,
  subtitle,
  actions,
  children,
  backPath,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  backPath?: string;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#16324f_0%,#07111f_38%,#020617_100%)] px-4 py-4 text-white">
      <div className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-7xl flex-col gap-4">
        <header className="flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/6 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/45">
              {appConfig.appName}
            </p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">{title}</h1>
            {subtitle ? (
              <p className="mt-2 text-sm font-semibold text-white/70">
                {subtitle}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </header>
        <div className="flex-1">{children}</div>
      </div>
      {backPath ? (
        <FloatingBackButton onBack={() => history.back()} fallbackPath={backPath} />
      ) : null}
    </main>
  );
}
