import {
  PASSWORD_SPECIAL_CHARACTERS,
  validarSenhaNova,
} from "@/constants/password";

describe("validação de senha", () => {
  it("accepts six characters with uppercase, number, and an allowed symbol", () => {
    expect(validarSenhaNova("Ab1!cd")).toBeNull();
  });

  it.each([
    ["Ab1!c", "6 caracteres"],
    ["ab1!cd", "letra maiúscula"],
    ["Abc!de", "número"],
    ["Abc123", "símbolo válido"],
    ["Ab1 cd", "símbolo válido"],
    ["Ab1€cd", "símbolo válido"],
  ])("rejects %s when it does not meet the password policy", (password, message) => {
    expect(validarSenhaNova(password)).toContain(message);
  });

  it("accepts every symbol in the explicit allowlist", () => {
    for (const symbol of PASSWORD_SPECIAL_CHARACTERS) {
      expect(validarSenhaNova(`Ab1${symbol}cd`)).toBeNull();
    }
  });
});
