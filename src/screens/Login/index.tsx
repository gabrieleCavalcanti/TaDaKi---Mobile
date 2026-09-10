import React, { useState } from "react";
import {
  View,
  Text,
  Alert,
  TouchableOpacity,
  TextInput,
  Image,
  ImageBackground,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";

import { RootStackParamList } from "../../../App";
import api from "../../api/api";

type NavigationProps = NativeStackNavigationProp<RootStackParamList, "Login">;

const { height } = Dimensions.get("window");

export default function LoginScreen() {
  const navigation = useNavigation<NavigationProps>();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function entrar() {
    try {
      const response = await api.post("/auth/login", {
        username: username.trim(),
        password,
      });

      console.log("Login realizado:", response.status);

      Alert.alert("Sucesso", "Login realizado com sucesso");

      navigation.navigate("Home");
    } catch (error: any) {
      console.log("Erro no login:", error.message);

      if (error.response?.status === 401) {
        return Alert.alert(
          "Erro",
          error.response.data?.message || "Usuário ou senha inválidos",
        );
      }

      Alert.alert(
        "Erro",
        error.response?.data?.message || "Falha ao conectar com o servidor",
      );
    }
  }

  return (
    <ImageBackground
      source={require("../../assets/fundoLogin.webp")}
      style={styles.background}
      resizeMode="cover"
    >
      {/* Fundo vermelho */}
      <View style={styles.redBackground}>
        <View style={styles.redCurve} />

        <Image
          source={require("../../assets/fundoLoginLoja.webp")}
          style={styles.backgroundLoja}
          resizeMode="contain"
        />
      </View>

      {/* Ajusta a tela quando o teclado abre */}
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Card de Login */}
          <View style={styles.card}>
            {/* Logo */}
            <Image
              source={require("../../assets/logoTaDaKi.webp")}
              style={styles.logo}
              resizeMode="contain"
            />

            {/* Usuário */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Usuário</Text>

              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Senha */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Senha:</Text>

              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <TouchableOpacity
                style={styles.forgotButton}
                onPress={() => {
                  // futuramente colocar recuperação de senha
                }}
              >
                <Text style={styles.forgotText}>
                  Esqueci minha senha
                </Text>
              </TouchableOpacity>
            </View>

            {/* Botão Entrar */}
            <TouchableOpacity
              style={styles.loginButton}
              onPress={entrar}
              activeOpacity={0.8}
            >
              <Text style={styles.loginButtonText}>Entrar</Text>
            </TouchableOpacity>

            {/* Cadastro */}
            <TouchableOpacity
              onPress={() => navigation.navigate("Cadastro")}
              activeOpacity={0.7}
            >
              <Text style={styles.registerText}>Cadastre-se</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: "#75080A",
  },

  keyboardContainer: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
  },

  backgroundLoja: {
    position: "absolute",

    width: 1080,
    height: 580,

    left: -180,
    bottom: 10,
  },

  redBackground: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,

    height: height * 0.48,

    backgroundColor: "#75080A",
  },

  redCurve: {
    position: "absolute",

    width: "170%",
    height: 300,

    left: "-65%",
    top: -100,

    backgroundColor: "#75080A",

    borderRadius: 1000,
  },

  card: {
    width: "90%",
    minHeight: height * 0.55,

    backgroundColor: "rgba(255, 255, 255, 0.78)",

    borderRadius: 55,

    paddingHorizontal: 28,
    paddingTop: 18,
    paddingBottom: 25,

    alignItems: "center",
    justifyContent: "center",
  },

  logo: {
    width: 210,
    height: 85,

    marginBottom: 20,
  },

  inputContainer: {
    width: "100%",
    marginBottom: 14,
  },

  label: {
    fontSize: 14,
    color: "#222",

    marginLeft: 10,
    marginBottom: 7,
  },

  input: {
    width: "100%",
    height: 43,

    backgroundColor: "#fff",

    borderRadius: 25,

    paddingHorizontal: 18,

    fontSize: 15,
    color: "#333",
  },

  loginButton: {
    width: "100%",
    height: 42,

    backgroundColor: "#75080A",

    borderRadius: 25,

    justifyContent: "center",
    alignItems: "center",

    marginTop: 10,
  },

  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
  },

  forgotButton: {
    alignSelf: "flex-end",

    marginTop: 3,
    marginRight: 8,
  },

  forgotText: {
    color: "#ee1c1c",
    fontSize: 11,
  },

  registerText: {
    color: "#75080A",

    fontSize: 16,

    marginTop: 35,
  },
});