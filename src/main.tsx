import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { backendHostOk, backendIdentityOk, startVersionWatch } from './lib/backend-guard'

const root = createRoot(document.getElementById('root')!)

// A build pointed at the wrong backend never shows the app: it would number parcels in a database
// nobody else sees. The screen tells the person what to do instead of failing quietly.
function StaleApp({ reason }: { reason: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow p-6 text-center space-y-3">
        <h1 className="text-xl font-bold text-slate-800">Versiune veche a aplicației</h1>
        <p className="text-slate-600">
          Această copie nu mai este conectată la baza de date a firmei. Închide aplicația, deschide din nou
          <b> colete.vercel.app</b> și intră iar cu PIN-ul.
        </p>
        <p className="text-xs text-slate-400">{reason}</p>
        <button
          type="button"
          onClick={() => window.location.replace('https://colete.vercel.app/?r=' + Date.now())}
          className="w-full rounded-xl bg-blue-600 text-white font-semibold py-3"
        >
          Deschide versiunea nouă
        </button>
      </div>
    </div>
  )
}

const host = backendHostOk()
if (!host.ok) {
  root.render(<StaleApp reason={host.reason} />)
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  )
  startVersionWatch()
  void backendIdentityOk().then((r) => {
    if (!r.ok) root.render(<StaleApp reason={r.reason} />)
  })
}
