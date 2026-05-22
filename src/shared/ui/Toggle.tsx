type ToggleProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl bg-card/70 px-4 py-3">
      <span className="text-sm font-medium text-text">{label}</span>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="relative h-7 w-12 rounded-full bg-white/10 transition peer-checked:bg-accent">
        <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
      </span>
    </label>
  )
}
