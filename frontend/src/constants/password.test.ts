import { MIN_PASSWORD_LENGTH, validarSenhaNova } from "@/constants/password";

describe("password validation", () => {
  it("requires at least twelve characters", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(12);
    expect(validarSenhaNova("a1b2")).not.toBeNull();
  });

  it("requires a letter", () => {
    expect(validarSenhaNova("123456789012")).toBe(
      "A senha deve conter pelo menos uma letra.",
    );
  });

  it("requires a number", () => {
    expect(validarSenhaNova("abcdefghijkl")).toBe(
      "A senha deve conter pelo menos um número.",
    );
  });

  it("accepts twelve characters containing a letter and a number", () => {
    expect(validarSenhaNova("SenhaSegura1")).toBeNull();
  });
});
