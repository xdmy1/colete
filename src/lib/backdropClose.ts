import type { MouseEvent } from 'react'

// Props pentru backdrop-ul unui modal: inchide DOAR daca apasarea a inceput
// SI s-a terminat pe backdrop. Altfel, daca selectezi text in modal si ridici
// cursorul pe backdrop, browserul declanseaza un `click` pe backdrop si te scotea
// din modal. Marcam pe elementul de overlay daca mousedown a pornit pe el.
export function backdropClose(onClose: () => void) {
  return {
    onMouseDown: (e: MouseEvent) => {
      if (e.target === e.currentTarget) {
        ;(e.currentTarget as HTMLElement).dataset.bdDown = '1'
      }
    },
    onClick: (e: MouseEvent) => {
      const el = e.currentTarget as HTMLElement
      const armed = el.dataset.bdDown === '1'
      delete el.dataset.bdDown
      if (armed && e.target === e.currentTarget) onClose()
    },
  }
}
