export function FloatingBackButton({
  onBack,
}: {
  onBack: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="fixed bottom-[5.25rem] left-4 z-40 rounded-full border border-white/10 bg-[#04101d]/92 px-4 py-3 text-sm font-black text-white shadow-[0_18px_50px_rgba(2,6,23,0.45)] backdrop-blur transition hover:bg-[#0a1b30]"
    >
      ← Назад
    </button>
  );
}
