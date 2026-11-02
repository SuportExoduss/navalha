// Atualização obrigatória: o app instalado fica atrás da versão mínima publicada em config/app?
// Versão ilegível ou ausente (de um lado ou do outro) nunca bloqueia: na dúvida, o app segue aberto.
function partes(v: string): number[] | null {
  if (!/^\d+(\.\d+)*$/.test(v)) return null;
  return v.split('.').map(Number);
}

export function precisaAtualizar(instalada: string | null | undefined, minima: string | null | undefined): boolean {
  const a = instalada ? partes(instalada) : null;
  const b = minima ? partes(minima) : null;
  if (!a || !b) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}
