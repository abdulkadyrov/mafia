export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (value: T) => void;
  items: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-1">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={[
            "rounded-xl px-4 py-2 text-sm font-bold transition",
            value === item.value
              ? "bg-white text-zinc-950"
              : "text-white/70 hover:bg-white/8 hover:text-white",
          ].join(" ")}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

