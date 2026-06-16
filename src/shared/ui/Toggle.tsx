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
      <span className="grid h-6 w-6 place-items-center rounded-md border-2 border-zinc-300 bg-white text-white transition peer-checked:border-zinc-950 peer-checked:bg-zinc-950">
        {checked ? (
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
          </svg>
        ) : null}
      </span>
    </label>
  );
}
