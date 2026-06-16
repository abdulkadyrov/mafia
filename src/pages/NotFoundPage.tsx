import { AppLayout } from "../core/layout/AppLayout";
import { Button } from "../core/ui/Button";

export function NotFoundPage({ onHome }: { onHome: () => void }) {
  return (
    <AppLayout title="Страница не найдена">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <p className="text-sm font-semibold text-white/72">
          Такой страницы нет в Abdulkadyrov Games.
        </p>
        <div className="mt-4">
          <Button onClick={onHome}>На главный экран</Button>
        </div>
      </div>
    </AppLayout>
  );
}

