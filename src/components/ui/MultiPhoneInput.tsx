import PhoneInput from './PhoneInput'

// Un numar principal + optional un numar de rezerva.
// Unii clienti dau 2 numere (unul de rezerva), asa ca afisam un buton "+"
// mic care adauga al doilea camp. "×" il scoate. Numarul de rezerva se
// stocheaza separat in `phone2` (undefined = niciun al doilea numar).

interface MultiPhoneInputProps {
  prefix: string                              // ex: "+44 " — pentru valoarea initiala
  phone: string
  phone2: string | undefined
  onPhoneChange: (next: string) => void
  onPhone2Change: (next: string | undefined) => void
  placeholder?: string
  placeholder2?: string
}

export default function MultiPhoneInput({
  prefix,
  phone,
  phone2,
  onPhoneChange,
  onPhone2Change,
  placeholder,
  placeholder2 = 'Număr de rezervă',
}: MultiPhoneInputProps) {
  const hasSecond = phone2 !== undefined

  return (
    <div className="space-y-2">
      <PhoneInput
        placeholder={placeholder}
        prefix={prefix}
        value={phone}
        onChange={onPhoneChange}
      />

      {hasSecond ? (
        <div className="flex items-stretch gap-2 animate-[fadeIn_.15s_ease]">
          <div className="flex-1 min-w-0">
            <PhoneInput
              placeholder={placeholder2}
              prefix={prefix}
              value={phone2}
              onChange={onPhone2Change}
            />
          </div>
          <button
            type="button"
            onClick={() => onPhone2Change(undefined)}
            aria-label="Șterge numărul de rezervă"
            title="Șterge numărul de rezervă"
            className="flex-shrink-0 w-11 rounded-xl border border-card-border flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-300 active:bg-red-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onPhone2Change(prefix)}
          className="inline-flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full text-sm font-semibold text-emerald-700 bg-pill-green-bg border border-pill-green-border hover:bg-emerald-100 active:bg-emerald-200 transition-colors"
        >
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-base leading-none pb-px">+</span>
          Încă un număr
        </button>
      )}
    </div>
  )
}
