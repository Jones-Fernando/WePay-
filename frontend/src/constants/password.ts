export const MIN_PASSWORD_LENGTH = 12;

export function validarSenhaNova(senha: string): string | null {
  if (senha.length < MIN_PASSWORD_LENGTH) {
    return `A senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (!/[A-Za-z]/.test(senha)) {
    return "A senha deve conter pelo menos uma letra.";
  }
  if (!/[0-9]/.test(senha)) {
    return "A senha deve conter pelo menos um número.";
  }
  return null;
}
