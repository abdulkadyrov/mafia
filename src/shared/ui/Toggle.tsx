type ToggleProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
      <span className="text-sm font-bold text-zinc-950">{label}</span>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="relative h-7 w-12 rounded-full bg-zinc-200 transition peer-checked:bg-zinc-950">
        <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
