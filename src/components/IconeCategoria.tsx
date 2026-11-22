import React from "react";
import {
  Image,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { ICONES_ICONS8 } from "@/constants/icons8EmojiAssets";

interface IconeCategoriaProps {
  icone: string;
  tamanho?: number;
  style?: StyleProp<ViewStyle>;
}

export function IconeCategoria({
  icone,
  tamanho = 22,
  style,
}: IconeCategoriaProps) {
  const dimensoes = { width: tamanho, height: tamanho };
  const imagem = ICONES_ICONS8[icone];

  return (
    <View
      style={[
        { alignItems: "center", justifyContent: "center" },
        dimensoes,
        style,
      ]}
    >
      {imagem ? (
        <Image
          source={imagem}
          style={dimensoes}
          resizeMode="contain"
          accessible={false}
        />
      ) : (
        <Text
          style={{ fontSize: tamanho, lineHeight: tamanho + 4 }}
          accessible={false}
        >
          {icone || "📌"}
        </Text>
      )}
    </View>
  );
}
