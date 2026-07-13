// Middleware desabilitado para compatibilidade com Static Export (GitHub Pages).
// A proteção de rotas é feita no client-side via layout do dashboard.
export function middleware() {
  // noop
}

export const config = {
  matcher: [],
}
