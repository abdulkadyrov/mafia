type NumberFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
};

export function NumberField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: NumberFieldProps) {
  function updateValue(nextValue: number) {
    onChange(Math.max(min, Math.min(max, nextValue)));
  }

  return (
    <label className="block rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <span className="mb-3 block text-sm font-bold text-zinc-500">
        {label}
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="h-10 w-10 rounded-lg border border-zinc-200 bg-white text-lg font-black text-zinc-950 transition hover:border-zinc-400"
          onClick={() => updateValue(value - 1)}
        >
          -
        </button>
        <input
          value={value}
          min={min}
          max={max}
          type="number"
          onChange={(event) => updateValue(Number(event.target.value))}
          className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-center text-base font-bold text-zinc-950 outline-none focus:border-zinc-950"
        />
        <button
          type="button"
          className="h-10 w-10 rounded-lg border border-zinc-200 bg-white text-lg font-black text-zinc-950 transition hover:border-zinc-400"
          onClick={() => updateValue(value + 1)}
        >
          +
        </button>
        {suffix ? (
          <span className="w-12 text-sm font-bold text-zinc-500">{suffix}</span>
        ) : null}
      </div>
    </label>
  );
}
