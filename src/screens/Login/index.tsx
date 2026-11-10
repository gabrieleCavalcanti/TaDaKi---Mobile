import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Alert,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  Animated,
  Easing,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";

import { RootStackParamList } from "../../../App";
import api from "../../api/api";
import { salvarTokens } from "../../storage/authStorage";

type NavigationProps = NativeStackNavigationProp<RootStackParamList, "Login">;

const VINHO = "#75080A";

// Marcador de loja (bolinha branca com ícone) que flutua parado
function Marker({
  icon,
  size,
  style,
  delay = 0,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  size: number;
  style: object;
  delay?: number;
}) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2400,
          delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float, delay]);

  const translateY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  return (
    <Animated.View
      style={[styles.marker, style, { transform: [{ translateY }] }]}
    >
      <Feather name={icon} size={size} color={VINHO} />
    </Animated.View>
  );
}

// Anel de "radar" lento atrás do card
function RadarRing({ delay }: { delay: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 5000,
        delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, delay]);

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1.5],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0.35, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.radarRing, { opacity, transform: [{ scale }] }]}
    />
  );
}

export default function LoginScreen() {
  const navigation = useNavigation<NavigationProps>();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function entrar() {
    if (!username.trim() || !password) {
      setErrorMessage("Preencha usuário e senha.");
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      const response = await api.post("/auth/login", {
        username: username.trim(),
        password,
      });

      if (response.data.token_acesso && response.data.refresh_token) {
        await salvarTokens(
          response.data.token_acesso,
          response.data.refresh_token,
        );
      }

      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    } catch (error: any) {
      console.log("Erro no login:", error.message);

      if (error.response?.status === 401) {
        setErrorMessage(
          error.response.data?.message || "Usuário ou senha inválidos",
        );
      } else {
        setErrorMessage(
          error.response?.data?.message || "Falha ao conectar com o servidor",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function entrarComGoogle() {
    // futuramente integrar login com Google (ex.: expo-auth-session)
    Alert.alert("Em breve", "Login com Google ainda não está disponível.");
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* TEXTO + MARCADORES */}
        <View style={styles.hero}>
          <View style={styles.eyebrow}>
            <Feather name="map-pin" size={13} color="#fff" />
            <Text style={styles.eyebrowText}>Vitrine local</Text>
          </View>

          <Text style={styles.heroTitle}>
            Conectando pessoas{"\n"}a microempresas{"\n"}
            <Text style={styles.heroHighlight}>perto de você.</Text>
          </Text>

          <Text style={styles.heroText}>
            Encontre negócios locais, valorize quem está pertinho e faça a
            diferença na sua região.
          </Text>

          <Marker
            icon="shopping-bag"
            size={20}
            style={styles.markerOne}
          />
          <Marker
            icon="coffee"
            size={18}
            style={styles.markerTwo}
            delay={600}
          />
          <Marker
            icon="scissors"
            size={16}
            style={styles.markerThree}
            delay={1200}
          />
        </View>

        {/* CARD + ONDAS */}
        <View style={styles.cardWrap}>
          <View style={styles.radar} pointerEvents="none">
            <RadarRing delay={0} />
            <RadarRing delay={1700} />
            <RadarRing delay={3400} />
          </View>

          <View style={styles.card}>
            <Image
              source={require("../../assets/logoTaDaKi.webp")}
              style={styles.logo}
              resizeMode="contain"
            />

            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Bem-vindo de volta</Text>
              <Text style={styles.cardSubtitle}>
                Entre para descobrir negócios perto de você
              </Text>
            </View>

            {/* Usuário */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Usuário</Text>
              <View style={styles.inputContainer}>
                <Feather
                  name="user"
                  size={18}
                  color="#8a8a8a"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="seu.nome"
                  placeholderTextColor="#b0b0b0"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Senha */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Senha</Text>
              <View style={styles.inputContainer}>
                <Feather
                  name="lock"
                  size={18}
                  color="#8a8a8a"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#b0b0b0"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.passwordToggle}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={18}
                    color="#8a8a8a"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

            {/* Lembre-me / Esqueceu */}
            <View style={styles.options}>
              <TouchableOpacity
                style={styles.rememberRow}
                onPress={() => setRemember(!remember)}
                activeOpacity={0.7}
              >
                <View
                  style={[styles.checkbox, remember && styles.checkboxChecked]}
                >
                  {remember && <Feather name="check" size={12} color="#fff" />}
                </View>
                <Text style={styles.rememberText}>Lembre-me</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  // futuramente colocar recuperação de senha
                }}
              >
                <Text style={styles.forgotText}>Esqueceu a senha?</Text>
              </TouchableOpacity>
            </View>

            {/* Botão Entrar */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={entrar}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.loginButtonContent}>
                  <Text style={styles.loginButtonText}>Entrar</Text>
                  <Feather name="arrow-right" size={17} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            {/* Divisor */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={entrarComGoogle}
              activeOpacity={0.8}
            >
              <Text style={styles.googleG}>G</Text>
              <Text style={styles.googleText}>Continuar com o Google</Text>
            </TouchableOpacity>

            {/* Cadastro */}
            <View style={styles.register}>
              <Text style={styles.registerText}>Não tem uma conta?</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("Cadastro")}
                activeOpacity={0.7}
              >
                <Text style={styles.registerLink}>Registre-se</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: VINHO,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },

  /* HERO */
  hero: {
    paddingTop: 64,
    paddingHorizontal: 28,
    paddingBottom: 36,
  },

  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.14)",
    marginBottom: 16,
  },

  eyebrowText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
  },

  heroTitle: {
    color: "#fff",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    marginBottom: 12,
  },

  heroHighlight: {
    color: "#ffb3b3",
  },

  heroText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    lineHeight: 21,
    maxWidth: "75%",
  },

  /* MARCADORES */
  marker: {
    position: "absolute",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },

  markerOne: {
    width: 52,
    height: 52,
    borderRadius: 26,
    right: 26,
    top: 70,
  },

  markerTwo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    right: 92,
    top: 140,
  },

  markerThree: {
    width: 36,
    height: 36,
    borderRadius: 18,
    right: 30,
    top: 186,
  },

  /* CARD + RADAR */
  cardWrap: {
    marginHorizontal: 20,
  },

  radar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  radarRing: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.7)",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },

  logo: {
    width: 150,
    height: 60,
    alignSelf: "center",
    marginBottom: 10,
  },

  cardHeader: {
    alignItems: "center",
    marginBottom: 18,
  },

  cardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#222",
    marginBottom: 4,
  },

  cardSubtitle: {
    fontSize: 13,
    color: "#777",
    textAlign: "center",
  },

  /* FORM */
  formGroup: {
    marginBottom: 14,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
    marginLeft: 4,
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    borderRadius: 14,
    backgroundColor: "#f4f4f5",
    borderWidth: 1,
    borderColor: "#e5e5e7",
    paddingHorizontal: 14,
  },

  inputIcon: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    fontSize: 15,
    color: "#333",
    paddingVertical: 0,
  },

  passwordToggle: {
    marginLeft: 8,
  },

  error: {
    color: "#c62828",
    fontSize: 12,
    marginBottom: 10,
    marginLeft: 4,
  },

  options: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
    marginTop: 2,
  },

  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#b5b5b8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },

  checkboxChecked: {
    backgroundColor: VINHO,
    borderColor: VINHO,
  },

  rememberText: {
    fontSize: 13,
    color: "#555",
  },

  forgotText: {
    fontSize: 13,
    color: VINHO,
    fontWeight: "600",
  },

  /* BOTÃO */
  loginButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: VINHO,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: VINHO,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },

  loginButtonDisabled: {
    opacity: 0.7,
  },

  loginButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  /* DIVISOR */
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 18,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e5e5e7",
  },

  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: "#999",
  },

  /* GOOGLE */
  googleButton: {
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "#dadce0",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  googleG: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4285F4",
  },

  googleText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#3c4043",
  },

  /* CADASTRO */
  register: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 20,
  },

  registerText: {
    fontSize: 14,
    color: "#666",
  },

  registerLink: {
    fontSize: 14,
    color: VINHO,
    fontWeight: "700",
  },
});