export const MIN_PASSWORD_LENGTH = 12;
export const PASSWORD_SPECIAL_CHARACTERS = "!@#$%^&*()-_=+[]{};:,.?";

export function validarSenhaNova(senha: string): string | null {
  const caracteres = Array.from(senha);
  if (caracteres.length < MIN_PASSWORD_LENGTH) {
    return `A senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (!/[A-Z]/.test(senha)) {
    return "A senha deve conter pelo menos uma letra maiúscula (A-Z).";
  }
  if (!/[0-9]/.test(senha)) {
    return "A senha deve conter pelo menos um número.";
  }
  if (!caracteres.some((caractere) => PASSWORD_SPECIAL_CHARACTERS.includes(caractere))) {
    return "A senha deve conter pelo menos um símbolo válido (por exemplo, !, @ ou #). Espaços não contam como símbolo.";
  }
  return null;
}
