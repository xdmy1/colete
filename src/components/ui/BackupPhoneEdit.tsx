// Control pentru numarul de rezerva in formularele de editare (input simplu).
// value === undefined  → afiseaza doar butonul "+ Încă un număr"
// value === string      → afiseaza inputul + buton "×" de stergere

export default function BackupPhoneEdit({
  value,
  onChange,
  inputCls,
  placeholder = 'Număr de rezervă',
}: {
  value: string | undefined
  onChange: (next: string | undefined) => void
  inputCls: string
  placeholder?: string
}) {
  if (value === undefined) {
    return (
      <button
        type="button"
        onClick={() => onChange('')}
        className="inline-flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full text-sm font-semibold text-emerald-700 bg-pill-green-bg border border-pill-green-border hover:bg-emerald-100 active:bg-emerald-200 transition-colors"
      >
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-base leading-none pb-px">+</span>
        Încă un număr
      </button>
    )
  }

  return (
    <div className="flex items-stretch gap-2 animate-[fadeIn_.15s_ease]">
      <input
        className={inputCls}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus
      />
      <button
        type="button"
        onClick={() => onChange(undefined)}
        aria-label="Șterge numărul de rezervă"
        title="Șterge numărul de rezervă"
        className="flex-shrink-0 w-10 rounded-xl border border-card-border flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-300 active:bg-red-50 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
