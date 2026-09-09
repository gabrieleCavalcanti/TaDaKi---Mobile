import {
  View,
  Text,
  Button,
  Alert,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../App";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import api from "../../api/api";
import { useState } from "react";

type NavigationProps = NativeStackNavigationProp<RootStackParamList, "Login">;

export default function LoginScreen() {
  const navigation = useNavigation<NavigationProps>();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // async function entrar() {
  //   if (!username.trim()) {
  //     return Alert.alert("Erro", "Usuário é obrigatório");
  //   }

  //   if (!password.trim()) {
  //     return Alert.alert("Erro", "Senha é obrigatória");
  //   }

  //   try {
  //     const response = await api.post("/auth/login", {
  //       username,
  //       password: password,
  //     });

  //     // const token = response.data.data.token_acesso;

  //     // console.log("TOKEN:", token);

  //     Alert.alert("Sucesso", "Login realizado com sucesso");

  //     navigation.navigate("Home");
  //   } catch (error: any) {
  //     console.log(error.response?.data);

  //     console.log(error.response?.data);

  //     if (error.response?.status === 401) {
  //       return Alert.alert(
  //         "Sessão inválida",
  //         "Seu token é inválido ou expirou. Faça login novamente.",
  //       );
  //     }

  //     Alert.alert("Erro", error.response?.data?.message || "Falha no login");
  //   }
  // }

  async function entrar() {
    console.log("1 - Tentando fazer login...");
    console.log("URL:", "/auth/login");
    console.log("Username:", username);

    try {
      console.log("2 - Enviando requisição...");

      const response = await api.post("/auth/login", {
        username: username.trim(),
        password,
      });

      console.log("3 - RESPOSTA:", response.status);
      console.log("4 - DATA:", response.data);

      Alert.alert("Sucesso", "Login realizado com sucesso");

      navigation.navigate("Home");
    } catch (error: any) {
      console.log("========== ERRO ==========");
      console.log("Mensagem:", error.message);
      console.log("Status:", error.response?.status);
      console.log("Resposta:", error.response?.data);
      console.log("==========================");

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
    <View>
      <Text>Login</Text>

      <View>
        <Text>Usuário:</Text>

        <TextInput
          placeholder="Usuário"
          value={username}
          onChangeText={setUsername}
        />
      </View>

      <View>
        <Text>Senha:</Text>

        <TextInput
          placeholder="Insira a senha"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      </View>

      {/* <Button
        title="Entrar"
        onPress={() => navigation.navigate("Home")}
      /> */}

      <TouchableOpacity onPress={entrar}>
        <Text>ENTRAR</Text>
      </TouchableOpacity>

      <Button
        title="Criar conta"
        onPress={() => navigation.navigate("Cadastro")}
      />
    </View>
  );
}
