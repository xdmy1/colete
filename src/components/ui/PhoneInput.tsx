import type { InputHTMLAttributes } from 'react'

// Input pentru numere de telefon cu prefix vizibil ca chip separat.
// Spatiul dintre prefix si numar e gap CSS (nu caracter), dar valoarea
// stocata pastreaza formatul existent "+44 1234567" pentru compatibilitate.

interface PhoneInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string
  prefix: string  // ex: "+44 " (cu spatiu final pentru formatul stocat)
  onChange: (next: string) => void
  inputCls?: string
}

function stripLeadingZero(value: string): string {
  return value.startsWith('0') ? value.slice(1) : value
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
  // Daca valoarea curenta incepe cu prefixul configurat, scoatem-o pentru afisare.
  // Altfel afisam toata valoarea (caz: contact selectat dintr-o alta tara).
  const trimmedPrefix = prefix.trim()
  const digits = value.startsWith(prefix)
    ? value.slice(prefix.length)
    : value.startsWith(trimmedPrefix)
      ? value.slice(trimmedPrefix.length).replace(/^\s+/, '')
      : value

  const defaultInputCls =
    'flex-1 min-w-0 px-4 py-3 rounded-xl border border-card-border text-base focus:outline-none focus:ring-1 focus:ring-pill-green-border focus:border-pill-green-border transition-colors'

  return (
    <div className={`flex items-stretch gap-2 ${className ?? ''}`}>
      <div className="px-3.5 rounded-xl bg-pill-green-bg border border-pill-green-border text-emerald-700 font-bold text-base flex items-center whitespace-nowrap select-none">
        {trimmedPrefix}
      </div>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder={placeholder}
        value={digits}
        onChange={(e) => onChange(prefix + stripLeadingZero(e.target.value))}
        className={inputCls ?? defaultInputCls}
        {...rest}
      />
    </div>
  )
}
