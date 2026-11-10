import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { RootStackParamList } from "../../../App";
import api from "../../api/api";

type Props = NativeStackScreenProps<RootStackParamList, "Cadastro">;

type AreaAtuacao = {
  id_area_atuacao: number;
  descricao: string;
};

type FeatherName = React.ComponentProps<typeof Feather>["name"];

const VINHO = "#75080A";

// =========================
// FORMATADORES / VALIDAÇÕES (iguais aos da web)
// =========================

const formatarTelefone = (valor: string) => {
  const numeros = valor.replace(/\D/g, "").slice(0, 11);

  if (numeros.length <= 2) {
    return numeros.length > 0 ? `(${numeros}` : "";
  }

  if (numeros.length <= 10) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}${
      numeros.length > 6 ? `-${numeros.slice(6, 10)}` : ""
    }`;
  }

  return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7, 11)}`;
};

const formatarDocumento = (valor: string, tipo: "cpf" | "cnpj") => {
  const numeros = valor.replace(/\D/g, "");

  if (tipo === "cpf") {
    return numeros
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  return numeros
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

const validarSenha = (senha: string): string | null => {
  if (senha.length < 8) {
    return "A senha deve ter pelo menos 8 caracteres.";
  }

  const senhasBloqueadas = [
    "12345678",
    "87654321",
    "abcdefgh",
    "password",
    "senha123",
    "qwerty123",
  ];

  if (senhasBloqueadas.includes(senha.toLowerCase())) {
    return "Essa senha é muito fácil de adivinhar. Escolha outra.";
  }

  if (/^(\d)\1+$/.test(senha)) {
    return "A senha não pode conter apenas números repetidos.";
  }

  if (/^\d+$/.test(senha)) {
    return "A senha não pode conter apenas números.";
  }

  return null;
};

const validarEmailGmail = (email: string): boolean =>
  /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email.trim());

const formatarData = (date: Date | null) => {
  if (!date) return "";

  const dia = String(date.getDate()).padStart(2, "0");
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const ano = date.getFullYear();

  return `${dia}/${mes}/${ano}`;
};

const dataParaISO = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

// =========================
// COMPONENTES AUXILIARES
// =========================

function Field({
  icon,
  right,
  ...props
}: {
  icon: FeatherName;
  right?: React.ReactNode;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.inputContainer}>
      <Feather name={icon} size={18} color="#8a8a8a" style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        placeholderTextColor="#b0b0b0"
        {...props}
      />
      {right}
    </View>
  );
}

function PasswordField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
}) {
  const [visivel, setVisivel] = useState(false);

  return (
    <Field
      icon="lock"
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      secureTextEntry={!visivel}
      autoCapitalize="none"
      autoCorrect={false}
      right={
        <TouchableOpacity
          onPress={() => setVisivel(!visivel)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name={visivel ? "eye-off" : "eye"} size={18} color="#8a8a8a" />
        </TouchableOpacity>
      }
    />
  );
}

function DateField({
  value,
  placeholder,
  onPress,
}: {
  value: Date | null;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.inputContainer}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Feather
        name="calendar"
        size={18}
        color="#8a8a8a"
        style={styles.inputIcon}
      />
      <Text style={[styles.dateText, !value && styles.placeholderText]}>
        {value ? formatarData(value) : placeholder}
      </Text>
    </TouchableOpacity>
  );
}

export default function CadastroScreen({ navigation }: Props) {
  const [tipoCadastro, setTipoCadastro] = useState<"organizacao" | "cliente">(
    "cliente",
  );
  const organizacao = tipoCadastro === "organizacao";

  // CAMPOS COMPARTILHADOS
  const [email, setEmail] = useState("");

  // CLIENTE
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacaoSenha, setConfirmacaoSenha] = useState("");
  const [dataNascimento, setDataNascimento] = useState<Date | null>(null);

  // ORGANIZAÇÃO
  const [nomeOrganizacao, setNomeOrganizacao] = useState("");
  const [usuarioOrganizacao, setUsuarioOrganizacao] = useState("");
  const [senhaOrganizacao, setSenhaOrganizacao] = useState("");
  const [confirmacaoSenhaOrganizacao, setConfirmacaoSenhaOrganizacao] =
    useState("");
  const [telefone, setTelefone] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState<"cpf" | "cnpj">("cnpj");
  const [documento, setDocumento] = useState("");
  const [dataCriacao, setDataCriacao] = useState<Date | null>(null);

  const [areasAtuacao, setAreasAtuacao] = useState<AreaAtuacao[]>([]);
  const [areaSelecionada, setAreaSelecionada] = useState<AreaAtuacao | null>(
    null,
  );
  const [mostrarDropdown, setMostrarDropdown] = useState(false);

  // CALENDÁRIO (qual campo está aberto)
  const [calendario, setCalendario] = useState<
    "nascimento" | "criacao" | null
  >(null);

  // MENSAGENS
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // BUSCAR ÁREAS
  useEffect(() => {
    async function carregarAreas() {
      try {
        const response = await api.get("/AreaAtuacao");

        if (Array.isArray(response.data?.resultadoSelecionaTodos)) {
          setAreasAtuacao(response.data.resultadoSelecionaTodos);
        } else {
          setAreasAtuacao([]);
        }
      } catch (error: any) {
        console.log(
          "Erro ao carregar áreas:",
          error.response?.data || error.message,
        );

        Alert.alert("Erro", "Não foi possível carregar as áreas de atuação.");
      }
    }

    carregarAreas();
  }, []);

  function alterarData(_event: any, date?: Date) {
    const alvo = calendario;
    setCalendario(null);

    if (!date) return;

    if (alvo === "nascimento") setDataNascimento(date);
    if (alvo === "criacao") setDataCriacao(date);
  }

  function trocarTipo(tipo: "organizacao" | "cliente") {
    setTipoCadastro(tipo);
    setErrorMessage(null);
  }

  function erro(mensagem: string) {
    setErrorMessage(mensagem);
  }

  // =========================
  // CADASTRAR
  // =========================

  async function cadastrar() {
    setErrorMessage(null);

    try {
      // ORGANIZAÇÃO
      if (organizacao) {
        if (
          !nomeOrganizacao.trim() ||
          !usuarioOrganizacao.trim() ||
          !email.trim() ||
          !telefone.trim() ||
          !senhaOrganizacao ||
          !confirmacaoSenhaOrganizacao ||
          !documento ||
          !dataCriacao ||
          !areaSelecionada
        ) {
          return erro("Preencha todos os campos.");
        }

        if (nomeOrganizacao.trim().length < 3) {
          return erro("O nome da organização deve ter pelo menos 3 caracteres.");
        }

        if (!validarEmailGmail(email)) {
          return erro("Digite um e-mail válido do Gmail (exemplo@gmail.com).");
        }

        const documentoNumeros = documento.replace(/\D/g, "");

        if (tipoDocumento === "cpf" && documentoNumeros.length !== 11) {
          return erro("Digite um CPF válido.");
        }

        if (tipoDocumento === "cnpj" && documentoNumeros.length !== 14) {
          return erro("Digite um CNPJ válido.");
        }

        const erroSenha = validarSenha(senhaOrganizacao);
        if (erroSenha) return erro(erroSenha);

        if (senhaOrganizacao !== confirmacaoSenhaOrganizacao) {
          return erro("As senhas não coincidem.");
        }

        setLoading(true);

        await api.post("/pessoas", {
          nome: nomeOrganizacao.trim(),
          tipo: "ORGANIZACAO",
          username: usuarioOrganizacao.trim(),
          password: senhaOrganizacao,

          email: email.trim(),
          telefone: telefone.replace(/\D/g, ""),

          cep: "",
          numero: "",

          cpf: tipoDocumento === "cpf" ? documentoNumeros : null,
          cnpj: tipoDocumento === "cnpj" ? documentoNumeros : null,

          data_criacao: dataParaISO(dataCriacao),
          id_area_atuacao: areaSelecionada.id_area_atuacao,
        });

        Alert.alert("Sucesso", "Organização cadastrada com sucesso!", [
          { text: "OK", onPress: () => navigation.navigate("Login") },
        ]);

        return;
      }

      // CLIENTE
      if (
        !nomeCompleto.trim() ||
        !usuario.trim() ||
        !email.trim() ||
        !senha ||
        !confirmacaoSenha ||
        !dataNascimento
      ) {
        return erro("Preencha todos os campos.");
      }

      if (nomeCompleto.trim().length < 3) {
        return erro("O nome deve ter pelo menos 3 caracteres.");
      }

      if (!validarEmailGmail(email)) {
        return erro("Digite um e-mail válido do Gmail (exemplo@gmail.com).");
      }

      const erroSenha = validarSenha(senha);
      if (erroSenha) return erro(erroSenha);

      if (senha !== confirmacaoSenha) {
        return erro("As senhas não coincidem.");
      }

      setLoading(true);

      await api.post("/pessoas", {
        nome: nomeCompleto.trim(),
        tipo: "CLIENTE",
        username: usuario.trim(),
        password: senha,
        email: email.trim(),
        data_nascimento: dataParaISO(dataNascimento),
      });

      Alert.alert("Sucesso", "Cliente cadastrado com sucesso!", [
        { text: "OK", onPress: () => navigation.navigate("Login") },
      ]);
    } catch (error: any) {
      console.log("Erro no cadastro:", error.message);
      console.log("Resposta do servidor:", error.response?.data);

      if (error.response?.status === 400) {
        return erro(error.response.data?.message || "Dados inválidos.");
      }

      if (error.response?.status === 409) {
        return erro(
          error.response.data?.message || "Usuário ou e-mail já cadastrado.",
        );
      }

      erro(error.response?.data?.message || "Falha ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* BOAS-VINDAS */}
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Olá, seja bem-vindo!</Text>
            <Text style={styles.heroText}>
              {organizacao
                ? "Você está se cadastrando como organização"
                : "Você está se cadastrando como cliente"}
            </Text>
          </View>

          {/* TOGGLE CLIENTE / ORGANIZAÇÃO */}
          <View style={styles.toggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, !organizacao && styles.toggleActive]}
              onPress={() => trocarTipo("cliente")}
              activeOpacity={0.8}
            >
              <Feather
                name="user"
                size={15}
                color={!organizacao ? VINHO : "#fff"}
              />
              <Text
                style={[
                  styles.toggleText,
                  !organizacao && styles.toggleTextActive,
                ]}
              >
                Cliente
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleBtn, organizacao && styles.toggleActive]}
              onPress={() => trocarTipo("organizacao")}
              activeOpacity={0.8}
            >
              <Feather
                name="briefcase"
                size={15}
                color={organizacao ? VINHO : "#fff"}
              />
              <Text
                style={[
                  styles.toggleText,
                  organizacao && styles.toggleTextActive,
                ]}
              >
                Organização
              </Text>
            </TouchableOpacity>
          </View>

          {/* CARD */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {organizacao ? "Cadastro de Organização" : "Cadastro de Cliente"}
            </Text>

            {organizacao ? (
              <>
                <Field
                  icon="briefcase"
                  placeholder="Nome da organização"
                  value={nomeOrganizacao}
                  onChangeText={setNomeOrganizacao}
                  autoCapitalize="words"
                />

                <Field
                  icon="user"
                  placeholder="Usuário"
                  value={usuarioOrganizacao}
                  onChangeText={setUsuarioOrganizacao}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Field
                  icon="mail"
                  placeholder="E-mail"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Field
                  icon="phone"
                  placeholder="(11) 99999-9999"
                  value={telefone}
                  onChangeText={(t) => setTelefone(formatarTelefone(t))}
                  keyboardType="phone-pad"
                  maxLength={15}
                />

                <PasswordField
                  placeholder="Senha"
                  value={senhaOrganizacao}
                  onChangeText={setSenhaOrganizacao}
                />

                <PasswordField
                  placeholder="Confirmar senha"
                  value={confirmacaoSenhaOrganizacao}
                  onChangeText={setConfirmacaoSenhaOrganizacao}
                />

                {/* CPF / CNPJ */}
                <View style={styles.documentoToggle}>
                  <TouchableOpacity
                    style={[
                      styles.documentoCard,
                      tipoDocumento === "cpf" && styles.documentoAtivo,
                    ]}
                    onPress={() => {
                      setTipoDocumento("cpf");
                      setDocumento("");
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.documentoIcone}>
                      <Feather name="user" size={16} color={VINHO} />
                    </View>
                    <View style={styles.documentoInfo}>
                      <Text style={styles.documentoTitulo}>CPF</Text>
                      <Text style={styles.documentoSub}>Pessoa Física</Text>
                    </View>
                    {tipoDocumento === "cpf" && (
                      <Feather name="check" size={16} color={VINHO} />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.documentoCard,
                      tipoDocumento === "cnpj" && styles.documentoAtivo,
                    ]}
                    onPress={() => {
                      setTipoDocumento("cnpj");
                      setDocumento("");
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.documentoIcone}>
                      <Feather name="briefcase" size={16} color={VINHO} />
                    </View>
                    <View style={styles.documentoInfo}>
                      <Text style={styles.documentoTitulo}>CNPJ</Text>
                      <Text style={styles.documentoSub}>Empresa</Text>
                    </View>
                    {tipoDocumento === "cnpj" && (
                      <Feather name="check" size={16} color={VINHO} />
                    )}
                  </TouchableOpacity>
                </View>

                <Field
                  icon="credit-card"
                  placeholder={
                    tipoDocumento === "cnpj"
                      ? "00.000.000/0000-00"
                      : "000.000.000-00"
                  }
                  value={documento}
                  onChangeText={(t) =>
                    setDocumento(formatarDocumento(t, tipoDocumento))
                  }
                  keyboardType="numeric"
                  maxLength={tipoDocumento === "cnpj" ? 18 : 14}
                />
                <Text style={styles.ajuda}>
                  Informe seu {tipoDocumento.toUpperCase()} (apenas números).
                </Text>

                {/* Área de atuação */}
                <TouchableOpacity
                  style={styles.inputContainer}
                  onPress={() => setMostrarDropdown(true)}
                  activeOpacity={0.7}
                >
                  <Feather
                    name="tag"
                    size={18}
                    color="#8a8a8a"
                    style={styles.inputIcon}
                  />
                  <Text
                    style={[
                      styles.dateText,
                      !areaSelecionada && styles.placeholderText,
                    ]}
                    numberOfLines={1}
                  >
                    {areaSelecionada
                      ? areaSelecionada.descricao
                      : "Área de atuação"}
                  </Text>
                  <Feather name="chevron-down" size={18} color="#8a8a8a" />
                </TouchableOpacity>

                {/* Data de criação */}
                <DateField
                  value={dataCriacao}
                  placeholder="Data de criação"
                  onPress={() => setCalendario("criacao")}
                />
                <Text style={styles.ajuda}>
                  Selecione a data de criação da organização
                </Text>
              </>
            ) : (
              <>
                <Field
                  icon="user"
                  placeholder="Nome completo"
                  value={nomeCompleto}
                  onChangeText={setNomeCompleto}
                  autoCapitalize="words"
                />

                <Field
                  icon="user"
                  placeholder="Usuário"
                  value={usuario}
                  onChangeText={setUsuario}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Field
                  icon="mail"
                  placeholder="E-mail"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <PasswordField
                  placeholder="Senha"
                  value={senha}
                  onChangeText={setSenha}
                />

                <PasswordField
                  placeholder="Confirmar senha"
                  value={confirmacaoSenha}
                  onChangeText={setConfirmacaoSenha}
                />

                <DateField
                  value={dataNascimento}
                  placeholder="Data de nascimento"
                  onPress={() => setCalendario("nascimento")}
                />
              </>
            )}

            {calendario && (
              <DateTimePicker
                value={
                  (calendario === "nascimento" ? dataNascimento : dataCriacao) ||
                  (calendario === "nascimento"
                    ? new Date(2000, 0, 1)
                    : new Date())
                }
                mode="date"
                display={Platform.OS === "android" ? "calendar" : "spinner"}
                maximumDate={new Date()}
                onChange={alterarData}
              />
            )}

            {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

            {/* Botão */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={cadastrar}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Cadastrar</Text>
                  <Feather name="arrow-right" size={17} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            {/* Já possui conta */}
            <View style={styles.loginLink}>
              <Text style={styles.loginLinkText}>Já possui uma conta?</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("Login")}
                activeOpacity={0.7}
              >
                <Text style={styles.loginLinkAction}>Entrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL ÁREA DE ATUAÇÃO */}
      <Modal
        visible={mostrarDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setMostrarDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalFundo}
          activeOpacity={1}
          onPress={() => setMostrarDropdown(false)}
        >
          <View style={styles.dropdownModal}>
            <Text style={styles.dropdownTitulo}>
              Selecione a área de atuação
            </Text>

            <ScrollView
              style={styles.listaAreas}
              showsVerticalScrollIndicator={false}
            >
              {areasAtuacao.map((area) => {
                const selecionada =
                  areaSelecionada?.id_area_atuacao === area.id_area_atuacao;

                return (
                  <TouchableOpacity
                    key={area.id_area_atuacao}
                    style={[
                      styles.opcaoArea,
                      selecionada && styles.opcaoAreaSelecionada,
                    ]}
                    onPress={() => {
                      setAreaSelecionada(area);
                      setMostrarDropdown(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.opcaoAreaTexto,
                        selecionada && styles.opcaoAreaTextoSelecionada,
                      ]}
                    >
                      {area.descricao}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.botaoFechar}
              onPress={() => setMostrarDropdown(false)}
            >
              <Text style={styles.botaoFecharTexto}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: VINHO,
  },

  flex: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingTop: 100,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },

  /* HERO */
  hero: {
    alignItems: "center",
    marginBottom: 18,
  },

  heroTitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 6,
  },

  heroText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    textAlign: "center",
  },

  /* TOGGLE */
  toggle: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 24,
    padding: 4,
    marginBottom: 18,
  },

  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
  },

  toggleActive: {
    backgroundColor: "#fff",
  },

  toggleText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },

  toggleTextActive: {
    color: VINHO,
  },

  /* CARD */
  card: {
    backgroundColor: "#fff",
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },

  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#222",
    textAlign: "center",
    marginBottom: 18,
  },

  /* CAMPOS */
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    borderRadius: 14,
    backgroundColor: "#f4f4f5",
    borderWidth: 1,
    borderColor: "#e5e5e7",
    paddingHorizontal: 14,
    marginBottom: 12,
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

  dateText: {
    flex: 1,
    fontSize: 15,
    color: "#333",
  },

  placeholderText: {
    color: "#b0b0b0",
  },

  ajuda: {
    fontSize: 11,
    color: "#888",
    marginTop: -6,
    marginBottom: 12,
    marginLeft: 6,
  },

  /* CPF / CNPJ */
  documentoToggle: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },

  documentoCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "#f4f4f5",
    borderWidth: 1.5,
    borderColor: "#e5e5e7",
  },

  documentoAtivo: {
    borderColor: VINHO,
    backgroundColor: "#fdf1f1",
  },

  documentoIcone: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  documentoInfo: {
    flex: 1,
  },

  documentoTitulo: {
    fontSize: 13,
    fontWeight: "700",
    color: "#222",
  },

  documentoSub: {
    fontSize: 10,
    color: "#777",
  },

  /* MENSAGEM + BOTÃO */
  error: {
    color: "#c62828",
    fontSize: 12,
    marginBottom: 10,
    marginLeft: 4,
  },

  button: {
    height: 48,
    borderRadius: 24,
    backgroundColor: VINHO,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    shadowColor: VINHO,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  loginLink: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 18,
  },

  loginLinkText: {
    fontSize: 14,
    color: "#666",
  },

  loginLinkAction: {
    fontSize: 14,
    color: VINHO,
    fontWeight: "700",
  },

  /* MODAL */
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
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
  },

  dropdownTitulo: {
    fontSize: 17,
    fontWeight: "700",
    color: "#222",
    textAlign: "center",
    marginBottom: 14,
  },

  listaAreas: {
    width: "100%",
  },

  opcaoArea: {
    minHeight: 44,
    backgroundColor: "#f4f4f5",
    borderRadius: 14,
    justifyContent: "center",
    paddingHorizontal: 15,
    marginBottom: 8,
  },

  opcaoAreaSelecionada: {
    backgroundColor: VINHO,
  },

  opcaoAreaTexto: {
    fontSize: 15,
    color: "#444",
  },

  opcaoAreaTextoSelecionada: {
    color: "#fff",
    fontWeight: "600",
  },

  botaoFechar: {
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: VINHO,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },

  botaoFecharTexto: {
    fontSize: 14,
    fontWeight: "600",
    color: VINHO,
  },
});