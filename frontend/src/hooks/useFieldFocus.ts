import { useState } from "react";
import type { TextInputProps } from "react-native";

type FocusHandlers = Pick<TextInputProps, "onFocus" | "onBlur">;

export function useFieldFocus() {
  const [focusedField, setFocusedField] = useState<string | null>(null);

  function focusHandlers(
    field: string,
    onBlur?: TextInputProps["onBlur"],
  ): FocusHandlers {
    return {
      onFocus: () => setFocusedField(field),
      onBlur: (event) => {
        setFocusedField((current) => current === field ? null : current);
        onBlur?.(event);
      },
    };
  }

  return { focusedField, focusHandlers };
}
