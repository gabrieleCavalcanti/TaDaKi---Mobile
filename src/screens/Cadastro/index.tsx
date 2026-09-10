import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ImageBackground,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";

import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../App";
import api from "../../api/api";

import DateTimePicker from "@react-native-community/datetimepicker";

type Props = NativeStackScreenProps<RootStackParamList, "Cadastro">;

type AreaAtuacao = {
  id_area_atuacao: number;
  descricao: string;
};

export default function CadastroScreen({ navigation }: Props) {
  const [tipoCadastro, setTipoCadastro] = useState<
    "organizacao" | "cliente"
  >("cliente");

  // =========================
  // ORGANIZAÇÃO
  // =========================

  const [nomeOrganizacao, setNomeOrganizacao] = useState("");
  const [usuarioOrganizacao, setUsuarioOrganizacao] = useState("");
  const [senhaOrganizacao, setSenhaOrganizacao] = useState("");
  const [confirmacaoSenhaOrganizacao, setConfirmacaoSenhaOrganizacao] =
    useState("");

  const [tipoDocumento, setTipoDocumento] = useState<"CPF" | "CNPJ">("CNPJ");
  const [cpf, setCpf] = useState("");
  const [cnpj, setCnpj] = useState("");

  const [areasAtuacao, setAreasAtuacao] = useState<AreaAtuacao[]>([]);
  const [areaSelecionada, setAreaSelecionada] =
    useState<AreaAtuacao | null>(null);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);

  // =========================
  // CLIENTE
  // =========================

  const [nomeCompleto, setNomeCompleto] = useState("");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacaoSenha, setConfirmacaoSenha] = useState("");

  // =========================
  // CAMPOS COMPARTILHADOS
  // =========================

  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cep, setCep] = useState("");
  const [numero, setNumero] = useState("");

  // =========================
  // DATA CLIENTE
  // =========================

  const [dataNascimento, setDataNascimento] = useState<Date | null>(null);
  const [mostrarCalendario, setMostrarCalendario] = useState(false);

  // =========================
  // BUSCAR ÁREAS
  // =========================

  useEffect(() => {
    async function carregarAreas() {
      try {
        const response = await api.get("/AreaAtuacao");

        console.log(
          "Áreas de atuação:",
          response.data.resultadoSelecionaTodos
        );

        setAreasAtuacao(response.data.resultadoSelecionaTodos);
      } catch (error: any) {
        console.log(
          "Erro ao carregar áreas:",
          error.response?.data || error.message
        );

        Alert.alert(
          "Erro",
          "Não foi possível carregar as áreas de atuação."
        );
      }
    }

    carregarAreas();
  }, []);

  // =========================
  // CALENDÁRIO
  // =========================

  const abrirCalendario = () => {
    setMostrarCalendario(true);
  };

  const alterarData = (event: any, date?: Date) => {
    setMostrarCalendario(false);

    if (date) {
      setDataNascimento(date);
    }
  };

  const formatarData = (date: Date | null) => {
    if (!date) return "";

    const dia = String(date.getDate()).padStart(2, "0");
    const mes = String(date.getMonth() + 1).padStart(2, "0");
    const ano = date.getFullYear();

    return `${dia}/${mes}/${ano}`;
  };

  // =========================
  // MÁSCARA CPF
  // =========================

  const formatarCPF = (texto: string) => {
    const numeros = texto.replace(/\D/g, "").slice(0, 11);

    let formatado = numeros;

    if (numeros.length > 3) {
      formatado = `${numeros.slice(0, 3)}.${numeros.slice(3)}`;
    }

    if (numeros.length > 6) {
      formatado = `${numeros.slice(0, 3)}.${numeros.slice(
        3,
        6
      )}.${numeros.slice(6)}`;
    }

    if (numeros.length > 9) {
      formatado = `${numeros.slice(0, 3)}.${numeros.slice(
        3,
        6
      )}.${numeros.slice(6, 9)}-${numeros.slice(9)}`;
    }

    return formatado;
  };

  // =========================
  // MÁSCARA CNPJ
  // =========================

  const formatarCNPJ = (texto: string) => {
    const numeros = texto.replace(/\D/g, "").slice(0, 14);

    let formatado = numeros;

    if (numeros.length > 2) {
      formatado = `${numeros.slice(0, 2)}.${numeros.slice(2)}`;
    }

    if (numeros.length > 5) {
      formatado = `${numeros.slice(0, 2)}.${numeros.slice(
        2,
        5
      )}.${numeros.slice(5)}`;
    }

    if (numeros.length > 8) {
      formatado = `${numeros.slice(0, 2)}.${numeros.slice(
        2,
        5
      )}.${numeros.slice(5, 8)}/${numeros.slice(8)}`;
    }

    if (numeros.length > 12) {
      formatado = `${numeros.slice(0, 2)}.${numeros.slice(
        2,
        5
      )}.${numeros.slice(5, 8)}/${numeros.slice(
        8,
        12
      )}-${numeros.slice(12)}`;
    }

    return formatado;
  };

  // =========================
  // DATA ATUAL
  // =========================

  const obterDataAtual = () => {
    const hoje = new Date();

    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;
  };

  // =========================
  // CADASTRAR
  // =========================

  async function cadastrar() {
    try {
      // =====================================
      // CADASTRO DE ORGANIZAÇÃO
      // =====================================

      if (tipoCadastro === "organizacao") {
        if (
          !nomeOrganizacao.trim() ||
          !usuarioOrganizacao.trim() ||
          !senhaOrganizacao ||
          !confirmacaoSenhaOrganizacao ||
          !email.trim() ||
          !telefone.trim() ||
          !cep.trim() ||
          !numero.trim() ||
          !areaSelecionada
        ) {
          Alert.alert("Atenção", "Preencha todos os campos.");
          return;
        }

        // Verifica se as senhas são iguais
        if (senhaOrganizacao !== confirmacaoSenhaOrganizacao) {
          Alert.alert("Atenção", "As senhas não são iguais.");
          return;
        }

        // Verifica CPF ou CNPJ
        if (tipoDocumento === "CPF") {
          const cpfNumeros = cpf.replace(/\D/g, "");

          if (cpfNumeros.length !== 11) {
            Alert.alert("Atenção", "Digite um CPF válido.");
            return;
          }
        } else {
          const cnpjNumeros = cnpj.replace(/\D/g, "");

          if (cnpjNumeros.length !== 14) {
            Alert.alert("Atenção", "Digite um CNPJ válido.");
            return;
          }
        }

        if (senhaOrganizacao.length < 8) {
          Alert.alert(
            "Atenção",
            "A senha deve ter pelo menos 8 caracteres."
          );
          return;
        }

        const response = await api.post("/pessoas", {
          nome: nomeOrganizacao.trim(),
          tipo: "ORGANIZACAO",
          username: usuarioOrganizacao.trim(),
          password: senhaOrganizacao,

          cep: cep.replace(/\D/g, ""),
          numero: numero.trim(),

          email: email.trim(),
          telefone: telefone.replace(/\D/g, ""),

          cpf:
            tipoDocumento === "CPF"
              ? cpf.replace(/\D/g, "")
              : null,

          cnpj:
            tipoDocumento === "CNPJ"
              ? cnpj.replace(/\D/g, "")
              : null,

          data_criacao: obterDataAtual(),

          id_area_atuacao: areaSelecionada.id_area_atuacao,
        });

        console.log("Organização cadastrada:", response.status);

        Alert.alert(
          "Sucesso",
          "Organização cadastrada com sucesso!",
          [
            {
              text: "OK",
              onPress: () => navigation.navigate("Login"),
            },
          ]
        );

        return;
      }

      // =====================================
      // CADASTRO DE CLIENTE
      // =====================================

      if (
        !nomeCompleto.trim() ||
        !email.trim() ||
        !telefone.trim() ||
        !cep.trim() ||
        !numero.trim() ||
        !dataNascimento ||
        !usuario.trim() ||
        !senha ||
        !confirmacaoSenha
      ) {
        Alert.alert("Atenção", "Preencha todos os campos.");
        return;
      }

      if (senha !== confirmacaoSenha) {
        Alert.alert("Atenção", "As senhas não são iguais.");
        return;
      }

      if (senha.length < 8) {
        Alert.alert(
          "Atenção",
          "A senha deve ter pelo menos 8 caracteres."
        );
        return;
      }

      const dataFormatada =
        `${dataNascimento.getFullYear()}-` +
        `${String(dataNascimento.getMonth() + 1).padStart(2, "0")}-` +
        `${String(dataNascimento.getDate()).padStart(2, "0")}`;

      const response = await api.post("/pessoas", {
        nome: nomeCompleto.trim(),
        tipo: "CLIENTE",
        data_nascimento: dataFormatada,
        username: usuario.trim(),
        password: senha,
        cep: cep.replace(/\D/g, ""),
        numero: numero.trim(),
        email: email.trim(),
        telefone: telefone.replace(/\D/g, ""),
      });

      console.log("Cliente cadastrado:", response.status);

      Alert.alert(
        "Sucesso",
        "Cliente cadastrado com sucesso!",
        [
          {
            text: "OK",
            onPress: () => navigation.navigate("Login"),
          },
        ]
      );
    } catch (error: any) {
      console.log("Erro no cadastro:", error.message);

      console.log(
        "Resposta do servidor:",
        error.response?.data
      );

      if (error.response?.status === 400) {
        return Alert.alert(
          "Erro",
          error.response.data?.message ||
            "Dados inválidos."
        );
      }

      if (error.response?.status === 409) {
        return Alert.alert(
          "Erro",
          error.response.data?.message ||
            "Usuário ou e-mail já cadastrado."
        );
      }

      Alert.alert(
        "Erro",
        error.response?.data?.message ||
          "Falha ao conectar com o servidor."
      );
    }
  }

  return (
    <ImageBackground
      source={require("../../assets/fundoLogin.webp")}
      style={styles.background}
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={
          Platform.OS === "ios" ? "padding" : "height"
        }
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* TIPO DE CADASTRO */}

          <View style={styles.tipoContainer}>
            <TouchableOpacity
              style={[
                styles.tipoBotao,
                tipoCadastro === "organizacao" &&
                  styles.tipoSelecionado,
              ]}
              onPress={() =>
                setTipoCadastro("organizacao")
              }
            >
              <Text
                style={[
                  styles.tipoTexto,
                  tipoCadastro === "organizacao" &&
                    styles.tipoTextoSelecionado,
                ]}
              >
                Organização
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tipoBotao,
                tipoCadastro === "cliente" &&
                  styles.tipoSelecionado,
              ]}
              onPress={() =>
                setTipoCadastro("cliente")
              }
            >
              <Text
                style={[
                  styles.tipoTexto,
                  tipoCadastro === "cliente" &&
                    styles.tipoTextoSelecionado,
                ]}
              >
                Cliente
              </Text>
            </TouchableOpacity>
          </View>

          {/* CARD */}

          <View
            style={[
              styles.card,
              tipoCadastro === "cliente"
                ? styles.cardCliente
                : styles.cardOrganizacao,
            ]}
          >
            {/* LOGO */}

            <Image
              source={require("../../assets/logoTaDaKi.webp")}
              style={styles.logo}
              resizeMode="contain"
            />

            {/* ================================= */}
            {/* ORGANIZAÇÃO */}
            {/* ================================= */}

            {tipoCadastro === "organizacao" ? (
              <>
                {/* Nome */}

                <View style={styles.campo}>
                  <Text style={styles.label}>
                    Nome Organização:
                  </Text>

                  <TextInput
                    value={nomeOrganizacao}
                    onChangeText={setNomeOrganizacao}
                    style={styles.input}
                    autoCapitalize="words"
                    placeholder="Digite o nome da organização"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* CPF / CNPJ */}

                <View style={styles.campo}>
                  <Text style={styles.label}>
                    Documento:
                  </Text>

                  <View style={styles.documentoContainer}>
                    <TouchableOpacity
                      style={[
                        styles.documentoBotao,
                        tipoDocumento === "CPF" &&
                          styles.documentoSelecionado,
                      ]}
                      onPress={() => {
                        setTipoDocumento("CPF");
                        setCnpj("");
                      }}
                    >
                      <Text
                        style={[
                          styles.documentoTexto,
                          tipoDocumento === "CPF" &&
                            styles.documentoTextoSelecionado,
                        ]}
                      >
                        CPF
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.documentoBotao,
                        tipoDocumento === "CNPJ" &&
                          styles.documentoSelecionado,
                      ]}
                      onPress={() => {
                        setTipoDocumento("CNPJ");
                        setCpf("");
                      }}
                    >
                      <Text
                        style={[
                          styles.documentoTexto,
                          tipoDocumento === "CNPJ" &&
                            styles.documentoTextoSelecionado,
                        ]}
                      >
                        CNPJ
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {tipoDocumento === "CPF" ? (
                    <TextInput
                      value={cpf}
                      onChangeText={(texto) =>
                        setCpf(formatarCPF(texto))
                      }
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="000.000.000-00"
                      placeholderTextColor="#999"
                      maxLength={14}
                    />
                  ) : (
                    <TextInput
                      value={cnpj}
                      onChangeText={(texto) =>
                        setCnpj(formatarCNPJ(texto))
                      }
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="00.000.000/0000-00"
                      placeholderTextColor="#999"
                      maxLength={18}
                    />
                  )}
                </View>

                {/* E-mail */}

                <View style={styles.campo}>
                  <Text style={styles.label}>
                    E-mail:
                  </Text>

                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="exemplo@gmail.com"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Telefone */}

                <View style={styles.campo}>
                  <Text style={styles.label}>
                    Telefone:
                  </Text>

                  <TextInput
                    value={telefone}
                    onChangeText={setTelefone}
                    style={styles.input}
                    keyboardType="phone-pad"
                    placeholder="(19) 99999-9999"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* CEP */}

                <View style={styles.campo}>
                  <Text style={styles.label}>
                    CEP:
                  </Text>

                  <TextInput
                    value={cep}
                    onChangeText={setCep}
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="00000-000"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Número */}

                <View style={styles.campo}>
                  <Text style={styles.label}>
                    Número:
                  </Text>

                  <TextInput
                    value={numero}
                    onChangeText={setNumero}
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="123"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Usuário */}

                <View style={styles.campo}>
                  <Text style={styles.label}>
                    Usuário:
                  </Text>

                  <TextInput
                    value={usuarioOrganizacao}
                    onChangeText={setUsuarioOrganizacao}
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Digite seu usuário"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Senha */}

                <View style={styles.campo}>
                  <Text style={styles.label}>
                    Senha:
                  </Text>

                  <TextInput
                    value={senhaOrganizacao}
                    onChangeText={setSenhaOrganizacao}
                    style={styles.input}
                    secureTextEntry
                    placeholder="Digite sua senha"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Confirmação Senha */}

                <View style={styles.campo}>
                  <Text style={styles.label}>
                    Confirmação Senha:
                  </Text>

                  <TextInput
                    value={confirmacaoSenhaOrganizacao}
                    onChangeText={setConfirmacaoSenhaOrganizacao}
                    style={styles.input}
                    secureTextEntry
                    placeholder="Confirme sua senha"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Área de atuação */}

                <View style={styles.campo}>
                  <Text style={styles.label}>
                    Área de atuação:
                  </Text>

                  <TouchableOpacity
                    style={styles.dropdown}
                    onPress={() =>
                      setMostrarDropdown(true)
                    }
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dropdownTexto,
                        !areaSelecionada &&
                          styles.dropdownPlaceholder,
                      ]}
                    >
                      {areaSelecionada
                        ? areaSelecionada.descricao
                        : "Selecione uma área"}
                    </Text>

                    <Text style={styles.seta}>
                      ▼
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Botão */}

                <TouchableOpacity
                  style={styles.botaoCadastrar}
                  onPress={cadastrar}
                  activeOpacity={0.8}
                >
                  <Text style={styles.textoCadastrar}>
                    Cadastrar
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* ================================= */}
                {/* CLIENTE */}
                {/* ================================= */}

                {/* Nome */}

                <View style={styles.campo}>
                  <Text style={styles.label}>
                    Nome Completo:
                  </Text>

                  <TextInput
                    value={nomeCompleto}
                    onChangeText={setNomeCompleto}
                    style={styles.input}
                    autoCapitalize="words"
                    placeholder="Digite seu nome completo"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* E-mail */}

                <View style={styles.campo}>
                  <Text style={styles.label}>
                    E-mail:
                  </Text>

                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="exemplo@gmail.com"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Telefone */}

                <View style={styles.campo}>
                  <Text style={styles.label}>
                    Telefone:
                  </Text>

                  <TextInput
                    value={telefone}
                    onChangeText={setTelefone}
                    style={styles.input}
                    keyboardType="phone-pad"
                    placeholder="(19) 99999-9999"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* CEP */}

                <View style={styles.campo}>
                  <Text style={styles.label}>
                    CEP:
                  </Text>

                  <TextInput
                    value={cep}
                    onChangeText={setCep}
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="00000-000"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Número */}

                <View style={styles.campo}>
                  <Text style={styles.label}>
                    Número:
                  </Text>

                  <TextInput
                    value={numero}
                    onChangeText={setNumero}
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="123"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Data de nascimento */}

                <View style={styles.campo}>
                  <Text style={styles.label}>
                    Data Nascimento:
                  </Text>

                  <TouchableOpacity
                    style={styles.input}
                    onPress={abrirCalendario}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dataTexto,
                        !dataNascimento &&
                          styles.placeholderData,
                      ]}
                    >
                      {dataNascimento
                        ? formatarData(dataNascimento)
                        : "Selecione sua data de nascimento"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {mostrarCalendario && (
                  <DateTimePicker
                    value={
                      dataNascimento ||
                      new Date(2000, 0, 1)
                    }
                    mode="date"
                    display={
                      Platform.OS === "android"
                        ? "calendar"
                        : "spinner"
                    }
                    maximumDate={new Date()}
                    onChange={alterarData}
                  />
                )}

                {/* Usuário */}

                <View style={styles.campo}>
                  <Text style={styles.label}>
                    Usuário:
                  </Text>

                  <TextInput
                    value={usuario}
                    onChangeText={setUsuario}
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Digite seu usuário"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Senha */}

                <View style={styles.campo}>
                  <Text style={styles.label}>
                    Senha:
                  </Text>

                  <TextInput
                    value={senha}
                    onChangeText={setSenha}
                    style={styles.input}
                    secureTextEntry
                    placeholder="Digite sua senha"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Confirmação */}

                <View style={styles.campo}>
                  <Text style={styles.label}>
                    Confirmação Senha:
                  </Text>

                  <TextInput
                    value={confirmacaoSenha}
                    onChangeText={setConfirmacaoSenha}
                    style={styles.input}
                    secureTextEntry
                    placeholder="Confirme sua senha"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Botão */}

                <TouchableOpacity
                  style={styles.botaoCadastrar}
                  onPress={cadastrar}
                  activeOpacity={0.8}
                >
                  <Text style={styles.textoCadastrar}>
                    Cadastrar
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL */}

      <Modal
        visible={mostrarDropdown}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setMostrarDropdown(false)
        }
      >
        <TouchableOpacity
          style={styles.modalFundo}
          activeOpacity={1}
          onPress={() =>
            setMostrarDropdown(false)
          }
        >
          <View style={styles.dropdownModal}>
            <Text style={styles.tituloDropdown}>
              Selecione a área de atuação
            </Text>

            <ScrollView
              style={styles.listaAreas}
              showsVerticalScrollIndicator={false}
            >
              {areasAtuacao.map((area) => (
                <TouchableOpacity
                  key={area.id_area_atuacao}
                  style={[
                    styles.opcaoArea,
                    areaSelecionada?.id_area_atuacao ===
                      area.id_area_atuacao &&
                      styles.opcaoAreaSelecionada,
                  ]}
                  onPress={() => {
                    setAreaSelecionada(area);
                    setMostrarDropdown(false);
                  }}
                >
                  <Text
                    style={[
                      styles.opcaoAreaTexto,
                      areaSelecionada?.id_area_atuacao ===
                        area.id_area_atuacao &&
                        styles.opcaoAreaTextoSelecionada,
                    ]}
                  >
                    {area.descricao}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.botaoFecharDropdown}
              onPress={() =>
                setMostrarDropdown(false)
              }
            >
              <Text style={styles.textoFecharDropdown}>
                Fechar
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },

  keyboardContainer: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingTop: 52,
    paddingBottom: 25,
  },

  // =========================
  // TIPO DE CADASTRO
  // =========================

  tipoContainer: {
    width: 180,
    height: 27,
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 28,
  },

  tipoBotao: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },

  tipoSelecionado: {
    backgroundColor: "#acd0b3",
  },

  tipoTexto: {
    fontFamily: "serif",
    fontSize: 12,
    color: "#777",
  },

  tipoTextoSelecionado: {
    color: "#ffffff",
  },

  // =========================
  // CARD
  // =========================

  card: {
    width: "88%",
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 32,
    alignItems: "center",
    paddingHorizontal: 22,
  },

  cardCliente: {
    minHeight: 600,
    paddingTop: 13,
    paddingBottom: 20,
  },

  cardOrganizacao: {
    minHeight: 850,
    paddingTop: 13,
    paddingBottom: 20,
  },

  // =========================
  // LOGO
  // =========================

  logo: {
    width: 145,
    height: 70,
    marginBottom: 12,
  },

  // =========================
  // CAMPOS
  // =========================

  campo: {
    width: "100%",
    marginBottom: 10,
  },

  label: {
    fontFamily: "serif",
    fontSize: 13,
    color: "#000",
    marginLeft: 8,
    marginBottom: 6,
  },

  input: {
    width: "100%",
    height: 43,
    backgroundColor: "#ffffff",
    borderRadius: 25,
    paddingHorizontal: 17,
    fontSize: 15,
    color: "#000",
  },

  // =========================
  // CPF / CNPJ
  // =========================

  documentoContainer: {
    width: "100%",
    height: 35,
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    marginBottom: 8,
    overflow: "hidden",
  },

  documentoBotao: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  documentoSelecionado: {
    backgroundColor: "#acd0b3",
  },

  documentoTexto: {
    fontFamily: "serif",
    fontSize: 12,
    color: "#777",
  },

  documentoTextoSelecionado: {
    color: "#ffffff",
  },

  // =========================
  // DROPDOWN
  // =========================

  dropdown: {
    width: "100%",
    height: 43,
    backgroundColor: "#ffffff",
    borderRadius: 25,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dropdownTexto: {
    fontSize: 15,
    color: "#000",
  },

  dropdownPlaceholder: {
    color: "#999",
  },

  seta: {
    fontSize: 14,
    color: "#777",
  },

  // =========================
  // MODAL
  // =========================

  modalFundo: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 25,
  },

  dropdownModal: {
    width: "100%",
    maxHeight: "75%",
    backgroundColor: "#ffffff",
    borderRadius: 25,
    padding: 20,
  },

  tituloDropdown: {
    fontFamily: "serif",
    fontSize: 18,
    color: "#000",
    textAlign: "center",
    marginBottom: 15,
  },

  listaAreas: {
    width: "100%",
  },

  opcaoArea: {
    width: "100%",
    minHeight: 45,
    backgroundColor: "#f5f5f5",
    borderRadius: 15,
    justifyContent: "center",
    paddingHorizontal: 15,
    marginBottom: 8,
  },

  opcaoAreaSelecionada: {
    backgroundColor: "#acd0b3",
  },

  opcaoAreaTexto: {
    fontFamily: "serif",
    fontSize: 15,
    color: "#555",
  },

  opcaoAreaTextoSelecionada: {
    color: "#ffffff",
  },

  botaoFecharDropdown: {
    width: "100%",
    height: 43,
    backgroundColor: "#acd0b3",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },

  textoFecharDropdown: {
    fontFamily: "serif",
    fontSize: 13,
    color: "#000",
  },

  // =========================
  // DATA
  // =========================

  dataTexto: {
    fontSize: 14,
    color: "#000",
    lineHeight: 43,
  },

  placeholderData: {
    color: "#999",
  },

  // =========================
  // BOTÃO
  // =========================

  botaoCadastrar: {
    width: "100%",
    height: 43,
    backgroundColor: "#acd0b3",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },

  textoCadastrar: {
    color: "#000",
    fontFamily: "serif",
    fontSize: 12,
  },
});