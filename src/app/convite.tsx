import React, { useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { participantesApi } from "@/services/api";
import { useUsuario } from "@/contexts/UsuarioContext";

export default function Convite() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { usuario, carregando: carregandoSessao } = useUsuario();
  const [aceitando, setAceitando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  async function aceitar() {
    if (!token || Array.isArray(token)) { setMensagem("Este convite não possui um token válido."); return; }
    try {
      setAceitando(true); setMensagem("");
      await participantesApi.aceitarConvite(token);
      setMensagem("Convite aceito. Você já faz parte do grupo.");
    } catch (erro) {
      setMensagem(erro instanceof Error ? erro.message : "Não foi possível aceitar o convite.");
    } finally { setAceitando(false); }
  }

  if (carregandoSessao) return <SafeAreaView style={styles.central}><ActivityIndicator size="large" color="#00A17A" /></SafeAreaView>;
  if (!usuario) return <SafeAreaView style={styles.central}><Text style={styles.titulo}>Você recebeu um convite</Text><Text style={styles.texto}>Entre ou crie uma conta com o mesmo e-mail que recebeu o convite para continuar.</Text><TouchableOpacity style={styles.principal} onPress={() => router.push({ pathname: "/(auth)/login", params: token ? { convite: token } : {} })}><Text style={styles.principalTexto}>Entrar</Text></TouchableOpacity><TouchableOpacity style={styles.secundario} onPress={() => router.push({ pathname: "/(auth)/cadastro", params: token ? { convite: token } : {} })}><Text style={styles.secundarioTexto}>Criar conta</Text></TouchableOpacity></SafeAreaView>;
  return <SafeAreaView style={styles.central}><View style={styles.icone}><Text style={styles.iconeTexto}>+</Text></View><Text style={styles.titulo}>Convite para grupo</Text><Text style={styles.texto}>Aceite para entrar no grupo e acompanhar despesas, saldos e pagamentos.</Text>{mensagem ? <Text style={styles.mensagem}>{mensagem}</Text> : null}<TouchableOpacity style={[styles.principal, aceitando && styles.desabilitado]} disabled={aceitando || Boolean(mensagem)} onPress={aceitar}><Text style={styles.principalTexto}>{aceitando ? "Aceitando..." : mensagem ? "Convite aceito" : "Aceitar convite"}</Text></TouchableOpacity><TouchableOpacity style={styles.secundario} onPress={() => router.replace("/(main)/group")}><Text style={styles.secundarioTexto}>Ver meus grupos</Text></TouchableOpacity></SafeAreaView>;
}
const styles=StyleSheet.create({central:{flex:1,backgroundColor:"#F5FBF7",padding:28,alignItems:"center",justifyContent:"center"},icone:{width:70,height:70,borderRadius:35,backgroundColor:"#DDF6ED",alignItems:"center",justifyContent:"center",marginBottom:20},iconeTexto:{color:"#00A17A",fontSize:40,fontWeight:"700"},titulo:{color:"#0B3B33",fontSize:24,fontWeight:"800",textAlign:"center"},texto:{color:"#6B8F86",fontSize:15,textAlign:"center",lineHeight:22,marginTop:12,maxWidth:330},mensagem:{color:"#0B3B33",backgroundColor:"#E9F9F3",padding:14,borderRadius:12,textAlign:"center",marginTop:20},principal:{minHeight:52,alignSelf:"stretch",backgroundColor:"#00A17A",borderRadius:14,alignItems:"center",justifyContent:"center",marginTop:28},principalTexto:{color:"#FFF",fontWeight:"800",fontSize:15},secundario:{minHeight:48,alignSelf:"stretch",alignItems:"center",justifyContent:"center",marginTop:5},secundarioTexto:{color:"#00A17A",fontWeight:"700"},desabilitado:{opacity:.65}});
