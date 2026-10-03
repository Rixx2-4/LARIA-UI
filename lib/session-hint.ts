// La portada no carga Clerk (pesa ~1 MB), pero puede saber si hay sesión por la
// cookie que Clerk deja en el dominio: __client_uat (a veces con un sufijo) vale
// "0" sin sesión y la hora del último inicio de sesión con ella. Es solo una pista:
// si se equivoca, la app pide entrar al llegar
const CLIENT_UAT = /(?:^|;\s*)__client_uat(?:_[^=;]+)?=(\d+)/g

export function looksSignedIn(cookies: string = typeof document === "undefined" ? "" : document.cookie): boolean {
  return [...cookies.matchAll(CLIENT_UAT)].some(([, value]) => Number(value) > 0)
}
