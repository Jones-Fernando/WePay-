import {
  PASSWORD_SPECIAL_CHARACTERS,
  validarSenhaNova,
} from "@/constants/password";

describe("validação de senha", () => {
  it("accepts twelve characters with uppercase, number, and an allowed symbol", () => {
    expect(validarSenhaNova("Ab1!cdefghij")).toBeNull();
  });

  it.each([
    ["Ab1!cdefghi", "12 caracteres"],
    ["abcdefghijk!", "letra maiúscula"],
    ["Abcdefgh!jkl", "número"],
    ["Abcdef123456", "símbolo válido"],
    ["Ab1 cdefghij", "símbolo válido"],
    ["Ab1€cdefghij", "símbolo válido"],
  ])("rejects %s when it does not meet the password policy", (password, message) => {
    expect(validarSenhaNova(password)).toContain(message);
  });

  it("accepts every symbol in the explicit allowlist", () => {
    for (const symbol of PASSWORD_SPECIAL_CHARACTERS) {
      expect(validarSenhaNova(`Ab1${symbol}cdefghij`)).toBeNull();
    }
  });
});
