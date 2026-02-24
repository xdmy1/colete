import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { loginWithPin } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pin.length < 4) {
      setError('Introdu minimum 4 cifre')
      return
    }

    setLoading(true)
    setError(null)
    const { error: loginError } = await loginWithPin(pin)
    if (loginError) {
      setError(loginError)
    }
    setLoading(false)
  }

  function handleDigit(digit: string) {
    if (pin.length < 6) {
      setPin((prev) => prev + digit)
    }
  }

  function handleDelete() {
    setPin((prev) => prev.slice(0, -1))
  }

  return (
    <div className="min-h-screen bg-soft-bg flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs">
        {/* Logo / Title */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 mx-auto mb-4 bg-pill-green-bg border border-pill-green-border rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Colete</h1>
          <p className="text-sm text-slate-400 mt-1">Introdu codul PIN</p>
        </div>

        {/* PIN display */}
        <form onSubmit={handleSubmit}>
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-12 h-12 rounded-xl border flex items-center justify-center text-xl font-bold transition-all ${
                  pin[i]
                    ? 'border-pill-green-border bg-pill-green-bg text-emerald-700 scale-105'
                    : 'border-card-border bg-white'
                }`}
              >
                {pin[i] ? '\u25CF' : ''}
              </div>
            ))}
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center mb-4 font-medium">{error}</p>
          )}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2.5 mb-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigit(digit)}
                className="h-14 rounded-xl bg-white border border-card-border text-xl font-semibold text-slate-700 hover:bg-gray-50 active:bg-gray-100 active:scale-95 transition-all"
              >
                {digit}
              </button>
            ))}
            <div /> {/* empty cell */}
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="h-14 rounded-xl bg-white border border-card-border text-xl font-semibold text-slate-700 hover:bg-gray-50 active:bg-gray-100 active:scale-95 transition-all"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="h-14 rounded-xl bg-white border border-card-border text-slate-400 hover:bg-gray-50 active:bg-gray-100 active:scale-95 transition-all flex items-center justify-center"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414-6.414a2 2 0 011.414-.586H19a2 2 0 012 2v10a2 2 0 01-2 2h-8.172a2 2 0 01-1.414-.586L3 12z"
                />
              </svg>
            </button>
          </div>

          <button
            type="submit"
            disabled={pin.length < 4 || loading}
            className="w-full py-3.5 rounded-full bg-pill-green-bg text-emerald-800 text-base font-bold border border-pill-green-border hover:bg-emerald-100 active:bg-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Se autentifică...' : 'Intră'}
          </button>
        </form>
      </div>
    </div>
  )
}
