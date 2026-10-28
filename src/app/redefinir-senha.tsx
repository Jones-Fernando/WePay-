import React, { useState } from "react";
import { Alert, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { authApi } from "@/services/api";

export default function RedefinirSenha() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  async function redefinir() {
    if (!token || Array.isArray(token)) { Alert.alert("Link inválido", "Solicite uma nova recuperação de senha."); return; }
    if (senha.length < 6) { Alert.alert("Senha inválida", "A senha deve ter ao menos 6 caracteres."); return; }
    if (senha !== confirmacao) { Alert.alert("Senhas diferentes", "Digite a mesma senha nos dois campos."); return; }
    if (salvando) return;
    try { setSalvando(true); await authApi.redefinirSenha(token, senha); Alert.alert("Senha redefinida", "Agora você já pode entrar com sua nova senha.", [{ text: "Ir para o login", onPress: () => router.replace("/(auth)/login") }]); }
    catch (erro) { Alert.alert("Não foi possível redefinir", erro instanceof Error ? erro.message : "Solicite um novo link."); }
    finally { setSalvando(false); }
  }
  return <SafeAreaView style={styles.container}><View style={styles.logo}><Text style={styles.logoTexto}>W</Text></View><Text style={styles.titulo}>Criar nova senha</Text><Text style={styles.subtitulo}>Escolha uma senha segura para voltar a acessar sua conta.</Text><View style={styles.form}><Text style={styles.rotulo}>Nova senha</Text><TextInput style={styles.campo} value={senha} onChangeText={setSenha} secureTextEntry placeholder="Mínimo de 6 caracteres" autoComplete="new-password"/><Text style={styles.rotulo}>Confirmar nova senha</Text><TextInput style={styles.campo} value={confirmacao} onChangeText={setConfirmacao} secureTextEntry placeholder="Repita a nova senha" autoComplete="new-password" onSubmitEditing={redefinir}/><TouchableOpacity style={[styles.botao,salvando&&styles.desabilitado]} disabled={salvando} onPress={redefinir}><Text style={styles.botaoTexto}>{salvando?"Salvando...":"Redefinir senha"}</Text></TouchableOpacity></View><TouchableOpacity style={styles.voltar} onPress={() => router.replace("/(auth)/login")}><Text style={styles.voltarTexto}>Voltar para o login</Text></TouchableOpacity></SafeAreaView>;
}
const styles=StyleSheet.create({container:{flex:1,backgroundColor:"#F5FBF7",padding:24,justifyContent:"center"},logo:{width:62,height:62,borderRadius:16,backgroundColor:"#00C896",alignItems:"center",justifyContent:"center",alignSelf:"center"},logoTexto:{fontSize:29,fontWeight:"800",color:"#0B3B33"},titulo:{fontSize:25,fontWeight:"800",color:"#0B3B33",textAlign:"center",marginTop:24},subtitulo:{fontSize:14,color:"#6B8F86",lineHeight:21,textAlign:"center",marginTop:9},form:{marginTop:28},rotulo:{fontWeight:"700",color:"#0B3B33",marginTop:14,marginBottom:7},campo:{minHeight:52,borderRadius:12,backgroundColor:"#FFF",borderWidth:1,borderColor:"#D7E7E0",paddingHorizontal:14,color:"#0B3B33"},botao:{minHeight:53,borderRadius:14,backgroundColor:"#00A17A",alignItems:"center",justifyContent:"center",marginTop:28},botaoTexto:{color:"#FFF",fontWeight:"800",fontSize:15},desabilitado:{opacity:.65},voltar:{alignItems:"center",marginTop:15},voltarTexto:{color:"#00A17A",fontWeight:"700"}});
