import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App";
import api, { imageUrl } from "../../api/api";
import { removerTokens } from "../../storage/authStorage";
import { colors } from "../Home/styles";

const LIMITE_FAVORITOS = 6;

interface Usuario {
  id_pessoa?: number;
  id_pessoa_login?: number;
  id_cliente?: number;
  nome?: string;
  username?: string;
  tipo?: string;
  data_nascimento?: string;
  imagem?: string;
  email?: string;
}

interface Contato {
  id_contato?: number;
  email?: string | null;
  principal?: number | boolean;
}

interface Favorito {
  id_favorito: number;
  id_cliente: number;
  id_organizacao: number;
  nome?: string;
  username?: string;
  area?: string;
  imagem?: string;
  id_pessoa?: number;
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

// Contas criadas no web podem ter "avatar:<id>" no campo imagem; isso não é uma URL.
function fotoValida(imagem?: string) {
  return Boolean(imagem) && !String(imagem).startsWith("avatar:");
}

function normalizar(valor?: string) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const ehPrincipal = (c: Contato) =>
  Number(c.principal) === 1 || c.principal === true;

// ISO (2000-05-31) -> "31/05/2000"
function isoParaBR(iso?: string) {
  const p = (iso ?? "").split("T")[0].split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : "";
}

// "31/05/2000" -> "2000-05-31" (ou "" se inválida)
function brParaISO(br: string) {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const [, d, mes, a] = m;
  const data = new Date(Number(a), Number(mes) - 1, Number(d));
  const valida =
    data.getFullYear() === Number(a) &&
    data.getMonth() === Number(mes) - 1 &&
    data.getDate() === Number(d);
  return valida ? `${a}-${mes}-${d}` : "";
}

function mascaraData(texto: string) {
  const n = texto.replace(/\D/g, "").slice(0, 8);
  if (n.length <= 2) return n;
  if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`;
  return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
}

function formatarData(data?: string) {
  if (!data) return "Não informado";
  const p = data.split("T")[0].split("-");
  if (p.length === 3 && MESES[Number(p[1]) - 1]) {
    return `${Number(p[2])} de ${MESES[Number(p[1]) - 1]} de ${p[0]}`;
  }
  return data;
}

function mensagemErro(error: any, padrao: string) {
  return error?.response?.data?.message || error?.message || padrao;
}

function primeiraLista(...valores: any[]): any[] {
  return valores.find((v) => Array.isArray(v)) ?? [];
}

export default function PerfilPessoalScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "PerfilPessoal">) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [loading, setLoading] = useState(true);

  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState("");
  const [username, setUsername] = useState("");
  const [dataNascimento, setDataNascimento] = useState(""); // DD/MM/AAAA

  const [adicionandoEmail, setAdicionandoEmail] = useState(false);
  const [novoEmail, setNovoEmail] = useState("");
  const [salvandoEmail, setSalvandoEmail] = useState(false);
  const [alterandoPrincipal, setAlterandoPrincipal] = useState(false);
  const [excluindoEmail, setExcluindoEmail] = useState<number | null>(null);

  const [favoritos, setFavoritos] = useState(0);
  const [favoritosAbertos, setFavoritosAbertos] = useState(false);
  const [listaFavoritos, setListaFavoritos] = useState<Favorito[]>([]);
  const [carregandoFavoritos, setCarregandoFavoritos] = useState(false);
  const [buscaFavoritos, setBuscaFavoritos] = useState("");
  const [limiteFavoritos, setLimiteFavoritos] = useState(LIMITE_FAVORITOS);

  // Ainda sem dados no backend (igual ao web).
  const likes = 0;
  const avaliacoes = 0;

  const deslogar = useCallback(() => {
    void removerTokens().then(() =>
      navigation.reset({ index: 0, routes: [{ name: "Login" }] }),
    );
  }, [navigation]);

  const tratarErro = useCallback(
    (error: any, padrao: string) => {
      if (error?.response?.status === 401) return deslogar();
      Alert.alert("Ops", mensagemErro(error, padrao));
    },
    [deslogar],
  );

  const carregarFavoritos = useCallback(async (u: Usuario) => {
    const idCliente = Number(u?.id_cliente);
    if (!idCliente) {
      setListaFavoritos([]);
      setFavoritos(0);
      return;
    }
    try {
      setCarregandoFavoritos(true);
      const { data: resp } = await api.get(`/Favoritos?id_cliente=${idCliente}`);
      const todos: Favorito[] = primeiraLista(
        resp?.favoritos,
        resp?.resultadoSelecionaTodos,
      );

      const vistos = new Set<number>();
      const recebidos = todos.filter((fav) => {
        if (Number(fav.id_cliente) !== idCliente) return false;
        const org = Number(fav.id_organizacao);
        if (vistos.has(org)) return false;
        vistos.add(org);
        return true;
      });

      setFavoritos(recebidos.length);
      if (recebidos.length === 0) {
        setListaFavoritos([]);
        return;
      }

      const { data: respOrg } = await api.get("/pessoas?tipo=ORGANIZACAO");
      const organizacoes: any[] = primeiraLista(
        respOrg?.funcionarios,
        respOrg?.organizacoes,
        respOrg?.pessoas,
        respOrg?.pessoaId,
        respOrg,
      );

      let areasPorId = new Map<number, string>();
      try {
        const { data: respAreas } = await api.get("/AreaAtuacao");
        const listaAreas: any[] = primeiraLista(
          respAreas?.resultadoSelecionaTodos,
          respAreas?.areas,
          respAreas?.dados,
          respAreas?.data,
          respAreas,
        );
        areasPorId = new Map(
          listaAreas.map((a: any): [number, string] => [
            Number(a.id_area_atuacao),
            String(a.descricao ?? ""),
          ]),
        );
      } catch (e) {
        console.error("Erro ao carregar áreas de atuação:", e);
      }

      setListaFavoritos(
        recebidos.map((fav) => {
          const org = organizacoes.find(
            (item: any) =>
              Number(item.id_organizacao) === Number(fav.id_organizacao) ||
              Number(item.id_pessoa) === Number(fav.id_organizacao) ||
              Number(item.id_pessoa_login) === Number(fav.id_organizacao),
          );
          return {
            ...fav,
            nome: org?.nome || org?.username || `Organização #${fav.id_organizacao}`,
            username: org?.username || "",
            area: areasPorId.get(Number(org?.id_area_atuacao)) || "",
            imagem: org?.imagem || "",
            id_pessoa: org?.id_pessoa,
          };
        }),
      );
    } catch (error) {
      console.error("Erro ao carregar favoritos:", error);
    } finally {
      setCarregandoFavoritos(false);
    }
  }, []);

  const carregarUsuario = useCallback(async () => {
    try {
      const { data: respLogin } = await api.get("/auth/me");
      const dadosLogin = respLogin?.user || respLogin;
      const idPessoa = dadosLogin?.id_pessoa ?? dadosLogin?.id_pessoa_login;
      if (!idPessoa) throw new Error("ID da pessoa não encontrado.");

      const { data: respPessoa } = await api.get(`/pessoas?id=${idPessoa}`);
      const listaPessoas = Array.isArray(respPessoa?.pessoaId)
        ? respPessoa.pessoaId
        : Array.isArray(respPessoa?.pessoas)
          ? respPessoa.pessoas
          : Array.isArray(respPessoa)
            ? respPessoa
            : respPessoa?.pessoaId
              ? [respPessoa.pessoaId]
              : [];
      const pessoa =
        listaPessoas.find((i: any) => Number(i.id_pessoa) === Number(idPessoa)) ||
        listaPessoas[0];
      if (!pessoa) throw new Error("Dados da pessoa não encontrados.");

      const { data: respContatos } = await api.get(
        `/contatos?id_pessoa=${idPessoa}&campo=email`,
      );
      const listaContatos: Contato[] = Array.isArray(respContatos?.contatoPessoa)
        ? respContatos.contatoPessoa.filter((c: Contato) => Boolean(c.email))
        : [];
      setContatos(listaContatos);

      const principal = listaContatos.find(ehPrincipal);
      const carregado: Usuario = {
        ...dadosLogin,
        ...pessoa,
        id_pessoa: Number(pessoa.id_pessoa ?? idPessoa),
        nome: pessoa.nome || dadosLogin.nome || "",
        username: pessoa.username || dadosLogin.username || "",
        tipo: pessoa.tipo || dadosLogin.tipo,
        data_nascimento: pessoa.data_nascimento || dadosLogin.data_nascimento || "",
        imagem: pessoa.imagem || dadosLogin.imagem || "",
        email: principal?.email || listaContatos[0]?.email || "",
      };

      setUsuario(carregado);
      setNome(carregado.nome || "");
      setUsername(carregado.username || "");
      setDataNascimento(isoParaBR(carregado.data_nascimento));
      await carregarFavoritos(carregado);
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
      tratarErro(error, "Erro ao carregar o perfil.");
    } finally {
      setLoading(false);
    }
  }, [carregarFavoritos, tratarErro]);

  useEffect(() => {
    void carregarUsuario();
  }, [carregarUsuario]);

  function alternarFavoritos() {
    const abrir = !favoritosAbertos;
    setFavoritosAbertos(abrir);
    if (abrir) {
      setBuscaFavoritos("");
      setLimiteFavoritos(LIMITE_FAVORITOS);
      if (usuario) void carregarFavoritos(usuario);
    }
  }

  function iniciarEdicao() {
    setNome(usuario?.nome || "");
    setUsername(usuario?.username || "");
    setDataNascimento(isoParaBR(usuario?.data_nascimento));
    setEditando(true);
  }

  function cancelarEdicao() {
    iniciarEdicao();
    setEditando(false);
    setAdicionandoEmail(false);
    setNovoEmail("");
  }

  async function salvarEdicao() {
    if (!usuario?.id_pessoa) return Alert.alert("Ops", "Não foi possível identificar a pessoa.");
    if (!nome.trim()) return Alert.alert("Ops", "O nome é obrigatório.");
    if (!username.trim()) return Alert.alert("Ops", "O nome de usuário é obrigatório.");

    const iso = dataNascimento ? brParaISO(dataNascimento) : "";
    if (dataNascimento && !iso) {
      return Alert.alert("Ops", "Informe uma data válida no formato DD/MM/AAAA.");
    }

    try {
      setSalvando(true);
      await api.patch(`/pessoas?id=${usuario.id_pessoa}`, {
        nome: nome.trim(),
        username: username.trim(),
        data_nascimento: iso || null,
      });
      setUsuario((a) =>
        a ? { ...a, nome: nome.trim(), username: username.trim(), data_nascimento: iso } : a,
      );
      setEditando(false);
      Alert.alert("Pronto", "Perfil atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      tratarErro(error, "Não foi possível atualizar o perfil.");
    } finally {
      setSalvando(false);
    }
  }

  async function adicionarEmail() {
    const email = novoEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Alert.alert("Ops", "Informe um e-mail válido.");
    }
    if (contatos.some((c) => c.email?.toLowerCase() === email)) {
      return Alert.alert("Ops", "Esse e-mail já está cadastrado.");
    }
    if (!usuario?.id_pessoa) return Alert.alert("Ops", "Não foi possível identificar a pessoa.");

    try {
      setSalvandoEmail(true);
      await api.post("/contatos", { email, id_pessoa: usuario.id_pessoa });
      setNovoEmail("");
      setAdicionandoEmail(false);
      await carregarUsuario();
      Alert.alert("Pronto", "E-mail cadastrado com sucesso!");
    } catch (error) {
      console.error("Erro ao adicionar e-mail:", error);
      tratarErro(error, "Não foi possível adicionar o e-mail.");
    } finally {
      setSalvandoEmail(false);
    }
  }

  async function definirEmailPrincipal(idContato: number) {
    if (!usuario?.id_pessoa || !idContato) return;
    try {
      setAlterandoPrincipal(true);
      await api.put(`/contatos/principal?id=${idContato}`, {
        id_pessoa: usuario.id_pessoa,
      });
      await carregarUsuario();
    } catch (error) {
      console.error("Erro ao alterar e-mail principal:", error);
      tratarErro(error, "Não foi possível alterar o e-mail principal.");
    } finally {
      setAlterandoPrincipal(false);
    }
  }

  function excluirEmail(idContato: number) {
    const contato = contatos.find((c) => c.id_contato === idContato);
    if (!contato) return;
    if (ehPrincipal(contato)) {
      return Alert.alert("Ops", "Selecione outro e-mail como principal antes de excluir este.");
    }
    Alert.alert("Excluir e-mail", "Deseja excluir este e-mail?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            setExcluindoEmail(idContato);
            await api.delete(`/contatos?id=${idContato}`);
            await carregarUsuario();
          } catch (error) {
            console.error("Erro ao excluir e-mail:", error);
            tratarErro(error, "Não foi possível excluir o e-mail.");
          } finally {
            setExcluindoEmail(null);
          }
        },
      },
    ]);
  }

  const termo = normalizar(buscaFavoritos);
  const favoritosFiltrados = useMemo(
    () =>
      termo
        ? listaFavoritos.filter(
            (f) =>
              normalizar(f.nome).includes(termo) || normalizar(f.area).includes(termo),
          )
        : listaFavoritos,
    [listaFavoritos, termo],
  );
  const favoritosVisiveis = favoritosFiltrados.slice(0, limiteFavoritos);
  const favoritosRestantes = favoritosFiltrados.length - favoritosVisiveis.length;

  const atividades = [
    {
      chave: "likes",
      titulo: "Curtidos",
      descricao: "Publicações que você curtiu",
      total: likes,
      icone: "heart-outline" as const,
      aoClicar: () => navigation.navigate("Likes"),
    },
    {
      chave: "favoritos",
      titulo: "Favoritos",
      descricao: "Negócios salvos para visitar",
      total: favoritos,
      icone: "bookmark-outline" as const,
      aoClicar: alternarFavoritos,
    },
    {
      chave: "avaliacoes",
      titulo: "Avaliações",
      descricao: "Opiniões que você compartilhou",
      total: avaliacoes,
      icone: "star-outline" as const,
      // Troque pela rota de avaliações do cliente quando ela existir no mobile.
      aoClicar: () => Alert.alert("Em breve", "As avaliações chegam em breve no app."),
    },
  ];

  if (loading) {
    return (
      <SafeAreaView style={st.centro}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={st.muted}>Carregando perfil...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.tela} edges={["top"]}>
      <View style={st.barra}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Voltar"
          style={st.botaoIcone}
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={st.barraTitulo}>Meu perfil</Text>
        <View style={st.botaoIcone} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={st.conteudo}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Cartão do topo */}
          <View style={st.topo}>
            <View style={st.avatar}>
              {fotoValida(usuario?.imagem) ? (
                <Image
                  source={{ uri: imageUrl(usuario?.imagem) }}
                  style={st.avatarImagem}
                />
              ) : (
                <Ionicons name="person" size={46} color="#fff" />
              )}
            </View>

            {editando ? (
              <View style={st.camposEdicao}>
                <Text style={st.rotuloTopo}>Nome completo</Text>
                <TextInput
                  style={st.inputTopo}
                  value={nome}
                  onChangeText={setNome}
                  placeholder="Digite seu nome"
                  maxLength={100}
                />
                <Text style={st.rotuloTopo}>Nome de usuário</Text>
                <TextInput
                  style={st.inputTopo}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Digite seu nome de usuário"
                  autoCapitalize="none"
                  maxLength={50}
                />
              </View>
            ) : (
              <View style={{ alignItems: "center", gap: 6 }}>
                <Text style={st.nome} numberOfLines={2}>
                  {usuario?.nome || usuario?.username || "Usuário"}
                </Text>
                <View style={st.usuarioPilula}>
                  <Text style={st.usuario}>@{usuario?.username || "usuario"}</Text>
                </View>
              </View>
            )}

            {editando ? (
              <View style={[st.linhaBotoes, { alignSelf: "stretch" }]}>
                <TouchableOpacity
                  style={[st.botaoPrimario, { flex: 1 }]}
                  onPress={salvarEdicao}
                  disabled={salvando}
                >
                  {salvando ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={17} color="#fff" />
                      <Text style={st.botaoPrimarioTexto}>Salvar</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.botaoSecundario, { flex: 1 }]}
                  onPress={cancelarEdicao}
                  disabled={salvando}
                >
                  <Ionicons name="close" size={17} color={colors.ink} />
                  <Text style={st.botaoSecundarioTexto}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[st.botaoSecundario, { alignSelf: "stretch" }]}
                onPress={iniciarEdicao}
              >
                <Ionicons name="pencil" size={16} color={colors.brand} />
                <Text style={[st.botaoSecundarioTexto, { color: colors.brand }]}>
                  Editar perfil
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Informações pessoais */}
          <View style={st.cartao}>
            <Text style={st.cartaoTitulo}>Informações pessoais</Text>

            <View style={st.info}>
              <View style={st.infoIcone}>
                <Ionicons name="calendar-outline" size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={st.muted}>Data de nascimento</Text>
                {editando ? (
                  <TextInput
                    style={st.input}
                    value={dataNascimento}
                    onChangeText={(t) => setDataNascimento(mascaraData(t))}
                    placeholder="DD/MM/AAAA"
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                ) : (
                  <Text style={st.valor}>{formatarData(usuario?.data_nascimento)}</Text>
                )}
              </View>
            </View>

            <View style={st.info}>
              <View style={st.infoIcone}>
                <Ionicons name="mail-outline" size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={st.muted}>E-mail</Text>
                <Text style={st.valor}>{usuario?.email || "Não informado"}</Text>

                {editando && (
                  <View style={{ gap: 8, marginTop: 6 }}>
                    {contatos.map((contato) => {
                      const principal = ehPrincipal(contato);
                      return (
                        <View style={st.itemEmail} key={contato.id_contato}>
                          <TouchableOpacity
                            style={st.selecaoEmail}
                            disabled={alterandoPrincipal || principal}
                            onPress={() =>
                              contato.id_contato && definirEmailPrincipal(contato.id_contato)
                            }
                          >
                            <Ionicons
                              name={principal ? "radio-button-on" : "radio-button-off"}
                              size={20}
                              color={colors.brand}
                            />
                            <Text style={st.emailTexto} numberOfLines={1}>
                              {contato.email}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            accessibilityLabel="Excluir e-mail"
                            disabled={principal || excluindoEmail === contato.id_contato}
                            style={[st.botaoIcone, principal && { opacity: 0.3 }]}
                            onPress={() => contato.id_contato && excluirEmail(contato.id_contato)}
                          >
                            <Ionicons name="close" size={18} color={colors.ink} />
                          </TouchableOpacity>
                        </View>
                      );
                    })}

                    {adicionandoEmail ? (
                      <View style={{ gap: 8 }}>
                        <TextInput
                          style={st.input}
                          value={novoEmail}
                          onChangeText={setNovoEmail}
                          placeholder="Digite o novo e-mail"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          maxLength={254}
                        />
                        <View style={st.linhaBotoes}>
                          <TouchableOpacity
                            style={[st.botaoPrimario, { flex: 1 }]}
                            onPress={adicionarEmail}
                            disabled={salvandoEmail}
                          >
                            {salvandoEmail ? (
                              <ActivityIndicator color="#fff" />
                            ) : (
                              <Text style={st.botaoPrimarioTexto}>Adicionar</Text>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[st.botaoSecundario, { flex: 1 }]}
                            disabled={salvandoEmail}
                            onPress={() => {
                              setAdicionandoEmail(false);
                              setNovoEmail("");
                            }}
                          >
                            <Text style={st.botaoSecundarioTexto}>Cancelar</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={st.linkAdicionar}
                        onPress={() => setAdicionandoEmail(true)}
                      >
                        <Ionicons name="add" size={16} color={colors.brand} />
                        <Text style={st.linkAdicionarTexto}>Adicionar e-mail</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Sua atividade */}
          <Text style={st.secaoTitulo}>Sua atividade</Text>
          {atividades.map((a) => (
            <TouchableOpacity key={a.chave} style={st.metrica} onPress={a.aoClicar}>
              <View style={st.metricaIcone}>
                <Ionicons name={a.icone} size={28} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={st.metricaTitulo}>{a.titulo}</Text>
                  {a.total > 0 && (
                    <View style={st.contador}>
                      <Text style={st.contadorTexto}>{a.total}</Text>
                    </View>
                  )}
                </View>
                <Text style={st.muted}>{a.descricao}</Text>
              </View>
              <Ionicons
                name={a.chave === "favoritos" && favoritosAbertos ? "chevron-down" : "chevron-forward"}
                size={18}
                color={colors.muted}
              />
            </TouchableOpacity>
          ))}

          {/* Lista de favoritos */}
          {favoritosAbertos && (
            <View style={st.cartao}>
              <View style={st.cabecalho}>
                <View style={{ flex: 1 }}>
                  <Text style={st.cartaoTitulo}>Meus favoritos</Text>
                  <Text style={st.muted}>Organizações que você salvou</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setFavoritosAbertos(false)}
                  accessibilityLabel="Fechar favoritos"
                  style={st.botaoIcone}
                >
                  <Ionicons name="close" size={22} color={colors.ink} />
                </TouchableOpacity>
              </View>

              {carregandoFavoritos ? (
                <ActivityIndicator color={colors.brand} />
              ) : listaFavoritos.length === 0 ? (
                <Text style={st.muted}>
                  Você ainda não adicionou organizações aos favoritos.
                </Text>
              ) : (
                <>
                  <View style={st.busca}>
                    <Ionicons name="search" size={18} color={colors.muted} />
                    <TextInput
                      style={{ flex: 1, color: colors.ink, paddingVertical: 10 }}
                      value={buscaFavoritos}
                      onChangeText={(t) => {
                        setBuscaFavoritos(t);
                        setLimiteFavoritos(LIMITE_FAVORITOS);
                      }}
                      placeholder="Buscar por nome ou área de atuação"
                      accessibilityLabel="Buscar nos favoritos"
                    />
                    {buscaFavoritos.length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          setBuscaFavoritos("");
                          setLimiteFavoritos(LIMITE_FAVORITOS);
                        }}
                        accessibilityLabel="Limpar busca"
                      >
                        <Ionicons name="close" size={18} color={colors.muted} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {termo && favoritosFiltrados.length > 0 && (
                    <Text style={st.muted}>
                      {favoritosFiltrados.length}{" "}
                      {favoritosFiltrados.length === 1
                        ? "favorito encontrado"
                        : "favoritos encontrados"}
                    </Text>
                  )}

                  {favoritosFiltrados.length === 0 ? (
                    <Text style={st.muted}>Nenhum favorito encontrado para essa busca.</Text>
                  ) : (
                    <>
                      {favoritosVisiveis.map((fav) => {
                        return (
                          <TouchableOpacity
                            key={fav.id_favorito}
                            style={st.itemFavorito}
                            onPress={() =>
                              fav.id_pessoa &&
                              navigation.navigate("Perfil", { id_pessoa: fav.id_pessoa })
                            }
                          >
                            {fotoValida(fav.imagem) ? (
                              <Image
                                source={{ uri: imageUrl(fav.imagem) }}
                                style={st.imgFavorito}
                              />
                            ) : (
                              <View style={[st.imgFavorito, { backgroundColor: colors.soft }]}>
                                <Ionicons name="storefront-outline" size={24} color={colors.brand} />
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={st.favoritoNome} numberOfLines={1}>
                                {fav.nome}
                              </Text>
                              {(fav.area || fav.username) && (
                                <Text style={st.muted} numberOfLines={1}>
                                  {fav.area || `@${fav.username}`}
                                </Text>
                              )}
                            </View>
                            <Ionicons name="star" size={18} color={colors.brand} />
                          </TouchableOpacity>
                        );
                      })}

                      {favoritosRestantes > 0 && (
                        <TouchableOpacity
                          style={st.botaoSecundario}
                          onPress={() => setLimiteFavoritos((l) => l + LIMITE_FAVORITOS)}
                        >
                          <Text style={st.botaoSecundarioTexto}>
                            Ver mais favoritos ({favoritosRestantes})
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  tela: { flex: 1, backgroundColor: "#fff" },
  centro: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: "#fff" },
  barra: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  barraTitulo: { fontSize: 17, fontWeight: "800", color: colors.ink },
  botaoIcone: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  conteudo: { padding: 16, gap: 14, paddingBottom: 40 },
  subtitulo: { color: colors.muted, fontSize: 14 },
  muted: { color: colors.muted, fontSize: 13 },

  topo: {
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.soft,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 20,
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.brand,
    borderWidth: 4,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImagem: { width: "100%", height: "100%" },
  nome: { color: colors.ink, fontSize: 22, fontWeight: "800", textAlign: "center" },
  usuarioPilula: {
    backgroundColor: "#fff",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  usuario: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  camposEdicao: { alignSelf: "stretch", gap: 6 },
  rotuloTopo: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  inputTopo: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink,
  },

  linhaBotoes: { flexDirection: "row", gap: 10 },
  botaoPrimario: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  botaoPrimarioTexto: { color: "#fff", fontWeight: "800" },
  botaoSecundario: {
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#fff",
  },
  botaoSecundarioTexto: { color: colors.ink, fontWeight: "700" },

  cartao: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 14,
  },
  cabecalho: { flexDirection: "row", alignItems: "center", gap: 8 },
  cartaoTitulo: { fontSize: 17, fontWeight: "800", color: colors.ink },
  secaoTitulo: { fontSize: 17, fontWeight: "800", color: colors.ink, marginTop: 4 },

  info: { flexDirection: "row", gap: 12 },
  infoIcone: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.soft,
    justifyContent: "center",
    alignItems: "center",
  },
  valor: { color: colors.ink, fontWeight: "700", fontSize: 15 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink,
  },
  itemEmail: { flexDirection: "row", alignItems: "center", gap: 4 },
  selecaoEmail: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  emailTexto: { flex: 1, color: colors.ink },
  linkAdicionar: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6 },
  linkAdicionarTexto: { color: colors.brand, fontWeight: "700" },

  metrica: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  metricaIcone: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.soft,
    justifyContent: "center",
    alignItems: "center",
  },
  metricaTitulo: { fontSize: 16, fontWeight: "800", color: colors.ink },
  contador: {
    backgroundColor: colors.brand,
    borderRadius: 10,
    minWidth: 22,
    paddingHorizontal: 6,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  contadorTexto: { color: "#fff", fontSize: 12, fontWeight: "800" },

  busca: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  itemFavorito: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  imgFavorito: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  favoritoNome: { fontWeight: "800", color: colors.ink },
});