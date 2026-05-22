type NumberFieldProps = {
  label: string
  value: number
  min: number
  max: number
  suffix?: string
  onChange: (value: number) => void
}

export function NumberField({ label, value, min, max, suffix, onChange }: NumberFieldProps) {
  function updateValue(nextValue: number) {
    onChange(Math.max(min, Math.min(max, nextValue)))
  }

  return (
    <label className="block rounded-xl bg-card/70 p-4">
      <span className="mb-3 block text-sm font-medium text-muted">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="h-10 w-10 rounded-xl bg-white/5 text-lg text-text transition hover:bg-white/10"
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
          className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-background px-3 text-center text-base font-semibold text-text outline-none focus:border-accent"
        />
        <button
          type="button"
          className="h-10 w-10 rounded-xl bg-white/5 text-lg text-text transition hover:bg-white/10"
          onClick={() => updateValue(value + 1)}
        >
          +
        </button>
        {suffix ? <span className="w-12 text-sm text-muted">{suffix}</span> : null}
      </div>
    </label>
  )
}
