import type { InputHTMLAttributes } from 'react'

// Input pentru numere de telefon cu prefix vizibil ca chip/dropdown separat.
// Spatiul dintre prefix si numar e gap CSS (nu caracter), dar valoarea
// stocata pastreaza formatul existent "+44 1234567" pentru compatibilitate.
//
// Daca primeste un altPrefix diferit de prefix (ex: ruta UK + MD), chip-ul
// devine dropdown pentru a putea schimba codul fara a sterge numarul.

interface PhoneInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string
  prefix: string         // ex: "+44 " (prefix-ul rutei/destinatiei)
  altPrefix?: string     // ex: "+373 " (de obicei MD — daca difera, apare dropdown)
  onChange: (next: string) => void
  inputCls?: string
}

function stripLeadingZero(value: string): string {
  return value.startsWith('0') ? value.slice(1) : value
}

function matchPrefix(value: string, candidate: string): string | null {
  const trimmed = candidate.trim()
  if (value.startsWith(candidate)) return value.slice(candidate.length)
  if (value.startsWith(trimmed)) return value.slice(trimmed.length).replace(/^\s+/, '')
  return null
}

export default function PhoneInput({
  value,
  prefix,
  altPrefix,
  onChange,
  inputCls,
  className,
  placeholder,
  ...rest
}: PhoneInputProps) {
  // Lista de prefixuri distincte (dupa forma trimmed-a, ca sa nu avem duplicate)
  const options = [prefix, ...(altPrefix && altPrefix.trim() !== prefix.trim() ? [altPrefix] : [])]

  // Detecteaza care prefix se potriveste pe valoarea curenta
  let currentPrefix = prefix
  let digits = value
  let matched = false
  for (const candidate of options) {
    const rest = matchPrefix(value, candidate)
    if (rest !== null) {
      currentPrefix = candidate
      digits = rest
      matched = true
      break
    }
  }
  if (!matched) {
    // Valoare neasteptata (ex: contact dintr-o alta tara) — pastreaza tot
    digits = value
  }

  const defaultInputCls =
    'flex-1 min-w-0 px-4 py-3 rounded-xl border border-card-border text-base focus:outline-none focus:ring-1 focus:ring-pill-green-border focus:border-pill-green-border transition-colors'

  function handleDigitsChange(raw: string) {
    onChange(currentPrefix + stripLeadingZero(raw))
  }

  function handlePrefixChange(newPrefix: string) {
    // pastreaza digits (deja extrase mai sus)
    onChange(newPrefix + digits)
  }

  return (
    <div className={`flex items-stretch gap-2 ${className ?? ''}`}>
      {options.length > 1 ? (
        <div className="relative">
          <select
            value={currentPrefix}
            onChange={(e) => handlePrefixChange(e.target.value)}
            aria-label="Cod tara"
            className="appearance-none pl-3.5 pr-7 h-full rounded-xl bg-pill-green-bg border border-pill-green-border text-emerald-700 font-bold text-base whitespace-nowrap cursor-pointer focus:outline-none focus:ring-1 focus:ring-pill-green-border"
          >
            {options.map((p) => (
              <option key={p} value={p}>
                {p.trim()}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-700 pointer-events-none"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      ) : (
        <div className="px-3.5 rounded-xl bg-pill-green-bg border border-pill-green-border text-emerald-700 font-bold text-base flex items-center whitespace-nowrap select-none">
          {currentPrefix.trim()}
        </div>
      )}
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder={placeholder}
        value={digits}
        onChange={(e) => handleDigitsChange(e.target.value)}
        className={inputCls ?? defaultInputCls}
        {...rest}
      />
    </div>
  )
}
