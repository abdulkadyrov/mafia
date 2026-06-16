import React from "react";

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 px-4">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#07111f] p-5 text-white shadow-[0_24px_90px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-black">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-3 py-1 text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            Закрыть
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

