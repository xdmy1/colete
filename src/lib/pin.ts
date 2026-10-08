// PIN-ul de login al soferilor: exact 4 cifre (tastatura din Login accepta fix atat).
//
// PIN-ul e si parola contului din Supabase Auth, dar GoTrue refuza parole sub
// 6 caractere, asa ca parola reala e derivata din PIN cu `pinToPassword`.
// Aceeasi functie e folosita la creare/editare sofer (api/admin-drivers.ts)
// si la login (hooks/useAuth.ts) — daca o schimbi, se schimba in ambele locuri.
//
// Conturile vechi, setate manual in SQL cu crypt(pin), au parola = PIN-ul brut;
// login-ul incearca si varianta asta.

export const PIN_LENGTH = 4

export const PIN_ERROR = `PIN invalid (exact ${PIN_LENGTH} cifre)`

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)
}

export function pinToPassword(pin: string): string {
  return `pin-${pin}`
}
