import { routes } from "../config/routes";

const NAV_ITEMS = [
  { label: "Главное", path: routes.home },
  { label: "Игры", path: routes.gamesHub },
  { label: "Настройки", path: routes.settingsHub },
] as const;

export function PrimaryNav({
  currentPath,
  onNavigate,
}: {
  currentPath: string;
  onNavigate: (path: string) => void;
}) {
  return (
    <nav className="fixed bottom-4 left-1/2 z-40 w-[min(100%-1.5rem,32rem)] -translate-x-1/2 rounded-full border border-white/10 bg-[#04101d]/92 p-2 shadow-[0_18px_50px_rgba(2,6,23,0.45)] backdrop-blur">
      <div className="grid grid-cols-3 gap-2">
        {NAV_ITEMS.map((item) => {
          const isActive = currentPath === item.path;

          return (
            <button
              key={item.path}
              type="button"
              onClick={() => onNavigate(item.path)}
              className={[
                "rounded-full px-3 py-2 text-xs font-black transition sm:text-sm",
                isActive
                  ? "bg-white text-zinc-950"
                  : "text-white/72 hover:bg-white/10",
              ].join(" ")}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
