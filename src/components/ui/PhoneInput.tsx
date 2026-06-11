import type { InputHTMLAttributes } from 'react'

// Input pentru numere de telefon cu cod tara editabil + numar separat.
// Doua inputuri vizibil distincte cu gap CSS intre ele.
// Valoarea stocata: "{cod} {numar}" (ex: "+44 1234567") — format compatibil
// cu datele existente.

interface PhoneInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string
  prefix: string         // ex: "+44 " — folosit doar pentru valoarea initiala
  onChange: (next: string) => void
  inputCls?: string
}

function stripLeadingZero(value: string): string {
  return value.startsWith('0') ? value.slice(1) : value
}

// Sparge "{cod} {numar}" in cele doua parti. Daca nu exista spatiu,
// totul e considerat cod (cazul initial cu doar prefixul).
function splitPhone(value: string): { code: string; digits: string } {
  const idx = value.indexOf(' ')
  if (idx < 0) return { code: value, digits: '' }
  return { code: value.slice(0, idx), digits: value.slice(idx + 1) }
}

export default function PhoneInput({
  value,
  prefix,
  onChange,
  inputCls,
  className,
  placeholder,
  ...rest
}: PhoneInputProps) {
  const effectiveValue = value || prefix
  const { code, digits } = splitPhone(effectiveValue)

  const defaultInputCls =
    'flex-1 min-w-0 px-4 py-3 rounded-xl border border-card-border text-base focus:outline-none focus:ring-1 focus:ring-pill-green-border focus:border-pill-green-border transition-colors'

  function emit(newCode: string, newDigits: string) {
    onChange(`${newCode} ${newDigits}`)
  }

  return (
    <div className={`flex items-stretch gap-2 ${className ?? ''}`}>
      <input
        type="tel"
        inputMode="tel"
        aria-label="Cod tara"
        value={code}
        onChange={(e) => emit(e.target.value.trim(), digits)}
        className="w-20 px-3 rounded-xl bg-pill-green-bg border border-pill-green-border text-emerald-700 font-bold text-base text-center focus:outline-none focus:ring-1 focus:ring-pill-green-border"
      />
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder={placeholder}
        value={digits}
        onChange={(e) => emit(code, stripLeadingZero(e.target.value))}
        className={inputCls ?? defaultInputCls}
        {...rest}
      />
    </div>
  )
}
