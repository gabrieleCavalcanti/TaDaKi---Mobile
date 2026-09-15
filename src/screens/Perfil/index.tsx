import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/api";

import {
    buscarAvaliacoesPorOrganizacao,
    calcularMediaAvaliacoes,
    IAvaliacao,
} from "../Avaliacao";

const NA = "N/A";

interface IPessoa {
    id_pessoa?: number;
    nome?: string;
    tipo?: string;
}

interface IOrganizacao extends IPessoa {
    cpf?: string;
    cnpj?: string;
    data_criacao?: string;
    id_area_atuacao?: number;
}

interface IPost {
    id_post?: number;
    vincularImagem?: string;
    titulo?: string;
    descricao?: string;
    id_categoria?: number;
    status?: string;
    id_organizacao?: number;
}

type Aba = "inicio" | "perfil" | "posts" | "avaliacoes";

export default function PerfilScreen({ route, navigation }: any) {
    const idPessoa = Number(route?.params?.id_pessoa);

    const [organizacao, setOrganizacao] =
        useState<IOrganizacao | null>(null);

    const [categoria, setCategoria] = useState(NA);
    const [posts, setPosts] = useState<IPost[]>([]);
    const [avaliacoes, setAvaliacoes] = useState<IAvaliacao[]>([]);

    const [loading, setLoading] = useState(true);
    const [loadingPosts, setLoadingPosts] = useState(false);
    const [abaSelecionada, setAbaSelecionada] =
        useState<Aba>("inicio");

    const media = calcularMediaAvaliacoes(avaliacoes);

    useEffect(() => {
        if (!idPessoa || isNaN(idPessoa)) {
            setLoading(false);
            return;
        }
        carregarDados();
    }, [idPessoa]);
    async function carregarDados() {
        try {
            setLoading(true);
            const pessoa = await buscarPessoa();
            if (
                !pessoa ||
                pessoa.tipo?.trim().toUpperCase() !== "ORGANIZACAO"
            ) {
                limparDados();
                await carregarAvaliacoes();
                return;
            }
            await carregarOrganizacao(pessoa);
            await Promise.all([
                carregarAvaliacoes(),
                carregarPosts(),
            ]);
        } catch (error) {
            console.error("Erro ao carregar perfil:", error);
            limparDados();
        } finally {
            setLoading(false);
        }
    }

    function limparDados() {
        setOrganizacao(null);
        setCategoria(NA);
        setPosts([]);
        setAvaliacoes([]);
    }

    async function buscarPessoa(): Promise<IPessoa | null> {
        try {
            const resposta = await api.get("/pessoas");
            const lista =
                resposta.data?.pessoas ||
                resposta.data?.funcionarios ||
                resposta.data?.dados ||
                resposta.data?.data ||
                [];

            return (
                lista.find(
                    (item: IPessoa) =>
                        Number(item.id_pessoa) === idPessoa
                ) || null
            );
        } catch (error) {
            console.error("Erro ao buscar pessoa:", error);
            return null;
        }
    }
    async function carregarOrganizacao(pessoa: IPessoa) {
        const organizacaoBasica: IOrganizacao = {
            id_pessoa: pessoa.id_pessoa,
            nome: pessoa.nome,
            tipo: pessoa.tipo,
        };

        try {
            const resposta = await api.get("/pessoas", {
                params: { tipo: "ORGANIZACAO" },
            });

            const lista =
                resposta.data?.funcionarios ||
                resposta.data?.pessoas ||
                resposta.data?.dados ||
                resposta.data?.data ||
                [];

            const encontrada = lista.find(
                (item: IOrganizacao) =>
                    Number(item.id_pessoa) === idPessoa
            );

            if (!encontrada) {
                setOrganizacao(organizacaoBasica);
                setCategoria(NA);
                return;
            }

            setOrganizacao(encontrada);

            if (encontrada.id_area_atuacao) {
                await carregarCategoria(
                    encontrada.id_area_atuacao
                );
            } else {
                setCategoria(NA);
            }
        } catch (error) {
            console.error("Erro ao buscar organização:", error);

            setOrganizacao(organizacaoBasica);
            setCategoria(NA);
        }
    }

    async function carregarCategoria(idArea: number) {
        try {
            const resposta = await api.get("/AreaAtuacao", {
                params: {
                    id_area_atuacao: idArea,
                },
            });

            const lista =
                resposta.data?.resultadoSelecionaId ||
                resposta.data?.dados ||
                resposta.data?.data ||
                [];

            setCategoria(lista[0]?.descricao || NA);
        } catch (error) {
            console.error(
                "Erro ao buscar área de atuação:",
                error
            );

            setCategoria(NA);
        }
    }

    async function carregarAvaliacoes() {
        try {
            const resultado =
                await buscarAvaliacoesPorOrganizacao(idPessoa);

            setAvaliacoes(resultado);
        } catch (error) {
            console.error("Erro ao buscar avaliações:", error);
            setAvaliacoes([]);
        }
    }

    async function carregarPosts() {
        try {
            setLoadingPosts(true);

            const resposta = await api.get(
                "/posts/organizacao",
                {
                    params: {
                        id_organizacao: idPessoa,
                    },
                }
            );

            setPosts(
                resposta.data?.posts ||
                resposta.data?.dados ||
                resposta.data?.data ||
                []
            );
        } catch (error) {
            console.error("Erro ao buscar posts:", error);
            setPosts([]);
        } finally {
            setLoadingPosts(false);
        }
    }
    function obterUrlImagem(nome?: string) {
        if (!nome) return "";

        if (
            nome.startsWith("http://") ||
            nome.startsWith("https://")
        ) {
            return nome;
        }

        const baseURL = api.defaults.baseURL;

        if (!baseURL) {
            console.error(
                "EXPO_PUBLIC_API_URL não foi configurada."
            );
            return "";
        }

        return `${baseURL.replace(/\/$/, "")}/uploads/${nome.replace(
            /^\//,
            ""
        )}`;
    }

    function mudarAba(aba: Aba) {
        setAbaSelecionada(aba);
    }

    /* =========================
       COMPONENTES
    ========================= */

    function Loading({ texto }: { texto: string }) {
        return (
            <View style={styles.carregando}>
                <ActivityIndicator size="large" color="#111" />
                <Text style={styles.carregandoTexto}>
                    {texto}
                </Text>
            </View>
        );
    }

    function SemPosts({ grande = false }: { grande?: boolean }) {
        return (
            <View
                style={
                    grande
                        ? styles.semPostsGrande
                        : styles.semPosts
                }
            >
                <Ionicons
                    name="newspaper-outline"
                    size={grande ? 45 : 38}
                    color="#999"
                />

                <Text style={styles.semPostsTexto}>
                    Nenhum post publicado.
                </Text>
            </View>
        );
    }

    function SemAvaliacoes() {
        return (
            <View style={styles.semAvaliacoesContainer}>
                <Ionicons
                    name="star-outline"
                    size={42}
                    color="#999"
                />

                <Text style={styles.semAvaliacoes}>
                    Nenhuma avaliação encontrada.
                </Text>
            </View>
        );
    }

    function PostCard({ post }: { post: IPost }) {
        const imagem = obterUrlImagem(post.vincularImagem);

        return (
            <TouchableOpacity
                style={styles.cardPost}
                activeOpacity={0.85}
            >
                {imagem ? (
                    <Image
                        source={{ uri: imagem }}
                        style={styles.imagemPost}
                    />
                ) : (
                    <View style={styles.imagemPostSemImagem}>
                        <Ionicons
                            name="image-outline"
                            size={35}
                            color="#999"
                        />
                    </View>
                )}

                <View style={styles.conteudoPost}>
                    <Text
                        style={styles.tituloPost}
                        numberOfLines={2}
                    >
                        {post.titulo || NA}
                    </Text>

                    {post.descricao && (
                        <Text
                            style={styles.descricaoPost}
                            numberOfLines={2}
                        >
                            {post.descricao}
                        </Text>
                    )}
                </View>
            </TouchableOpacity>
        );
    }

    function PostCompleto({ post }: { post: IPost }) {
        const imagem = obterUrlImagem(post.vincularImagem);

        return (
            <View style={styles.postCompleto}>
                {imagem ? (
                    <Image
                        source={{ uri: imagem }}
                        style={styles.imagemPostCompleta}
                    />
                ) : (
                    <View
                        style={
                            styles.imagemPostCompletaSemImagem
                        }
                    >
                        <Ionicons
                            name="image-outline"
                            size={45}
                            color="#999"
                        />
                    </View>
                )}

                <View style={styles.postTexto}>
                    <Text style={styles.tituloPostCompleto}>
                        {post.titulo || NA}
                    </Text>

                    {post.descricao && (
                        <Text
                            style={
                                styles.descricaoPostCompleta
                            }
                        >
                            {post.descricao}
                        </Text>
                    )}
                </View>
            </View>
        );
    }

    function AvaliacaoCard({
        avaliacao,
    }: {
        avaliacao: IAvaliacao;
    }) {
        const nota = Number(avaliacao.csat);

        return (
            <View style={styles.cardAvaliacao}>
                <View style={styles.avatarCliente}>
                    <Ionicons
                        name="person"
                        size={28}
                        color="#777"
                    />
                </View>

                <View style={styles.dadosAvaliacao}>
                    <Text style={styles.nomeCliente}>
                        {Number(avaliacao.anonimo) === 1
                            ? "Usuário anônimo"
                            : avaliacao.nome_cliente ||
                              "Usuário"}
                    </Text>

                    <View style={styles.estrelas}>
                        {[1, 2, 3, 4, 5].map((estrela) => (
                            <Ionicons
                                key={estrela}
                                name={
                                    estrela <= nota
                                        ? "star"
                                        : "star-outline"
                                }
                                size={17}
                                color="#111"
                            />
                        ))}
                    </View>

                    <Text style={styles.tituloAvaliacao}>
                        {avaliacao.titulo || NA}
                    </Text>
                </View>

                <Text style={styles.nota}>
                    {avaliacao.csat}
                </Text>
            </View>
        );
    }

    function TituloSecao({
        titulo,
        acao,
    }: {
        titulo: string;
        acao?: boolean;
    }) {
        return (
            <View style={styles.tituloLinha}>
                <Text style={styles.titulo}>{titulo}</Text>

                {acao && (
                    <TouchableOpacity
                        style={styles.verTodos}
                        onPress={() =>
                            mudarAba(
                                titulo.includes("Post")
                                    ? "posts"
                                    : "avaliacoes"
                            )
                        }
                    >
                        <Text style={styles.textoVerTodos}>
                            Ver todos
                        </Text>

                        <Ionicons
                            name="add-circle-outline"
                            size={20}
                            color="#111"
                        />
                    </TouchableOpacity>
                )}
            </View>
        );
    }
    function AbaInicio() {
        return (
            <View>
                <View style={styles.estatisticas}>
                    <Estatistica
                        icon="heart-outline"
                        numero="459"
                        texto="Favoritado"
                    />

                    <View style={styles.divisor} />

                    <Estatistica
                        icon="newspaper-outline"
                        numero={String(posts.length)}
                        texto="Posts"
                    />

                    <View style={styles.divisor} />

                    <Estatistica
                        icon="star-outline"
                        numero={String(media)}
                        texto="Avaliação média"
                    />
                </View>

                <TituloSecao
                    titulo="Destaques"
                    acao={posts.length > 0}
                />

                {loadingPosts && (
                    <Loading texto="Carregando posts..." />
                )}

                {!loadingPosts && posts.length === 0 && (
                    <SemPosts />
                )}

                {!loadingPosts && posts.length > 0 && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.destaques}
                    >
                        {posts
                            .slice(0, 5)
                            .map((post) => (
                                <PostCard
                                    key={post.id_post}
                                    post={post}
                                />
                            ))}
                    </ScrollView>
                )}

                <TituloSecao
                    titulo="Avaliações dos clientes"
                    acao={avaliacoes.length > 0}
                />

                {loading && (
                    <Loading texto="Carregando avaliações..." />
                )}

                {!loading && avaliacoes.length === 0 && (
                    <SemAvaliacoes />
                )}

                {!loading &&
                    avaliacoes
                        .slice(0, 5)
                        .map((avaliacao) => (
                            <AvaliacaoCard
                                key={avaliacao.id_avaliacao}
                                avaliacao={avaliacao}
                            />
                        ))}

                {!loading && avaliacoes.length > 5 && (
                    <TouchableOpacity
                        style={styles.botaoVerMais}
                        onPress={() =>
                            mudarAba("avaliacoes")
                        }
                    >
                        <Text
                            style={styles.botaoVerMaisTexto}
                        >
                            Ver todas {avaliacoes.length}{" "}
                            avaliações
                        </Text>

                        <Ionicons
                            name="arrow-forward"
                            size={21}
                            color="#111"
                        />
                    </TouchableOpacity>
                )}
            </View>
        );
    }

    function AbaPerfil() {
        return (
            <View style={styles.conteudoAba}>
                <Text style={styles.tituloAba}>Perfil</Text>

                <Text style={styles.textoAba}>
                    Informações da organização.
                </Text>

                {organizacao && (
                    <View style={styles.infoOrganizacao}>
                        <Text
                            style={
                                styles.infoOrganizacaoTexto
                            }
                        >
                            Nome: {organizacao.nome}
                        </Text>

                        <Text
                            style={
                                styles.infoOrganizacaoTexto
                            }
                        >
                            Tipo: {organizacao.tipo}
                        </Text>

                        <Text
                            style={
                                styles.infoOrganizacaoTexto
                            }
                        >
                            ID: {organizacao.id_pessoa}
                        </Text>
                    </View>
                )}
            </View>
        );
    }

    function AbaPosts() {
        return (
            <View>
                <View style={styles.tituloLinha}>
                    <Text style={styles.titulo}>Posts</Text>

                    <Text style={styles.contadorPosts}>
                        {posts.length}{" "}
                        {posts.length === 1 ? "post" : "posts"}
                    </Text>
                </View>

                {loadingPosts && (
                    <Loading texto="Carregando posts..." />
                )}

                {!loadingPosts && posts.length === 0 && (
                    <SemPosts grande />
                )}

                {!loadingPosts &&
                    posts.map((post) => (
                        <PostCompleto
                            key={post.id_post}
                            post={post}
                        />
                    ))}
            </View>
        );
    }

    function AbaAvaliacoes() {
        return (
            <View>
                <View style={styles.tituloLinha}>
                    <Text style={styles.titulo}>
                        Avaliações dos clientes
                    </Text>

                    <View style={styles.mediaContainer}>
                        <Ionicons
                            name="star"
                            size={18}
                            color="#111"
                        />

                        <Text style={styles.mediaTexto}>
                            {media}
                        </Text>
                    </View>
                </View>

                {loading && (
                    <Loading texto="Carregando avaliações..." />
                )}

                {!loading && avaliacoes.length === 0 && (
                    <SemAvaliacoes />
                )}

                {!loading &&
                    avaliacoes.map((avaliacao) => (
                        <AvaliacaoCard
                            key={avaliacao.id_avaliacao}
                            avaliacao={avaliacao}
                        />
                    ))}

                {!loading && avaliacoes.length > 0 && (
                    <View style={styles.resumoAvaliacoes}>
                        <Text style={styles.resumoTexto}>
                            {avaliacoes.length}{" "}
                            {avaliacoes.length === 1
                                ? "avaliação encontrada"
                                : "avaliações encontradas"}
                        </Text>
                    </View>
                )}
            </View>
        );
    }

    function Estatistica({
        icon,
        numero,
        texto,
    }: {
        icon: any;
        numero: string;
        texto: string;
    }) {
        return (
            <View style={styles.estatistica}>
                <Ionicons
                    name={icon}
                    size={32}
                    color="#111"
                />

                <Text style={styles.numero}>{numero}</Text>

                <Text style={styles.label}>{texto}</Text>
            </View>
        );
    }

    /* =========================
       TELA
    ========================= */

    return (
        <View style={styles.container}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* CABEÇALHO */}
                <View style={styles.topo}>
                    <TouchableOpacity
                        style={styles.botaoVoltar}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons
                            name="arrow-back"
                            size={30}
                            color="#111"
                        />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menu}>
                        <Ionicons
                            name="menu"
                            size={32}
                            color="#111"
                        />
                    </TouchableOpacity>

                    <View style={styles.perfil}>
                        <View style={styles.avatar}>
                            <Ionicons
                                name="storefront-outline"
                                size={50}
                                color="#777"
                            />
                        </View>

                        <View style={styles.informacoes}>
                            <Text style={styles.nomeLoja}>
                                {organizacao?.nome ||
                                    "Organização"}
                            </Text>

                            <Text style={styles.categoria}>
                                {categoria}
                            </Text>

                            <InfoLinha
                                icon="location"
                                texto={NA}
                            />

                            <InfoLinha
                                icon="call"
                                texto={NA}
                            />
                        </View>

                        <View style={styles.acoes}>
                            <TouchableOpacity
                                style={styles.favoritar}
                            >
                                <Ionicons
                                    name="heart-outline"
                                    size={18}
                                    color="#111"
                                />

                                <Text
                                    style={styles.textoAcao}
                                >
                                    Favoritar
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.compartilhar}
                            >
                                <Ionicons
                                    name="share-social-outline"
                                    size={19}
                                    color="#111"
                                />

                                <Text
                                    style={
                                        styles.textoCompartilhar
                                    }
                                >
                                    Compartilhar
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* NAVEGAÇÃO */}
                <View style={styles.areaMenu}>
                    <View style={styles.menuNavegacao}>
                        <BotaoAba
                            aba="inicio"
                            icon="home"
                        />

                        <BotaoAba
                            aba="perfil"
                            icon="person-outline"
                        />

                        <BotaoAba
                            aba="posts"
                            icon="bag"
                        />

                        <BotaoAba
                            aba="avaliacoes"
                            icon="star"
                        />
                    </View>

                    <View style={styles.linha} />

                    {/* CONTEÚDO */}
                    {abaSelecionada === "inicio" && (
                        <AbaInicio />
                    )}

                    {abaSelecionada === "perfil" && (
                        <AbaPerfil />
                    )}

                    {abaSelecionada === "posts" && (
                        <AbaPosts />
                    )}

                    {abaSelecionada === "avaliacoes" && (
                        <AbaAvaliacoes />
                    )}
                </View>
            </ScrollView>
        </View>
    );

    function BotaoAba({
        aba,
        icon,
    }: {
        aba: Aba;
        icon: any;
    }) {
        const selecionada = abaSelecionada === aba;

        return (
            <TouchableOpacity
                style={[
                    styles.iconeMenu,
                    selecionada &&
                        styles.iconeMenuSelecionado,
                ]}
                onPress={() => mudarAba(aba)}
            >
                <Ionicons
                    name={icon}
                    size={31}
                    color={selecionada ? "#111" : "#888"}
                />
            </TouchableOpacity>
        );
    }

    function InfoLinha({
        icon,
        texto,
    }: {
        icon: any;
        texto: string;
    }) {
        return (
            <View style={styles.infoLinha}>
                <Ionicons
                    name={icon}
                    size={16}
                    color="#111"
                />

                <Text style={styles.infoTexto}>
                    {texto}
                </Text>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F4F2E2",
    },

    scrollContent: {
        paddingBottom: 30,
    },

    topo: {
        height: 215,
        backgroundColor: "#ACCCB1",
        borderBottomLeftRadius: 100,
        borderBottomRightRadius: 100,
        paddingTop: 35,
        paddingHorizontal: 20,
    },

    botaoVoltar: {
        position: "absolute",
        left: 14,
        top: 12,
        width: 50,
        height: 50,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
    },

    menu: {
        position: "absolute",
        right: 14,
        top: 12,
        width: 50,
        height: 50,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
    },

    perfil: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 42,
    },

    avatar: {
        width: 92,
        height: 92,
        borderRadius: 50,
        backgroundColor: "#D6D6D6",
        alignItems: "center",
        justifyContent: "center",
    },

    informacoes: {
        marginLeft: 16,
        flex: 1,
    },

    nomeLoja: {
        fontSize: 21,
        fontWeight: "600",
        color: "#111",
        marginBottom: 3,
    },

    categoria: {
        fontSize: 16,
        color: "#111",
        marginBottom: 9,
    },

    infoLinha: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 6,
    },

    infoTexto: {
        fontSize: 13,
        color: "#111",
        marginLeft: 6,
    },

    acoes: {
        position: "absolute",
        right: 0,
        bottom: 48,
        alignItems: "flex-end",
    },

    favoritar: {
        backgroundColor: "#F4F2E2",
        borderRadius: 18,
        paddingHorizontal: 12,
        paddingVertical: 8,
        minHeight: 38,
        flexDirection: "row",
        alignItems: "center",
    },

    textoAcao: {
        fontSize: 12,
        marginLeft: 5,
        color: "#111",
        fontWeight: "500",
    },

    compartilhar: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 11,
        padding: 4,
    },

    textoCompartilhar: {
        fontSize: 12,
        marginLeft: 5,
        color: "#111",
    },

    areaMenu: {
        paddingHorizontal: 18,
    },

    menuNavegacao: {
        height: 78,
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
    },

    iconeMenu: {
        width: 58,
        height: 58,
        borderRadius: 29,
        alignItems: "center",
        justifyContent: "center",
    },

    iconeMenuSelecionado: {
        backgroundColor: "#DDE9D9",
    },

    linha: {
        height: 1,
        backgroundColor: "#B8B5A8",
        marginHorizontal: 12,
        marginBottom: 20,
    },

    estatisticas: {
        minHeight: 100,
        backgroundColor: "#ACCCB1",
        borderRadius: 35,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 32,
        paddingVertical: 10,
    },

    estatistica: {
        flex: 1,
        alignItems: "center",
    },

    divisor: {
        width: 1,
        height: 60,
        backgroundColor: "#91B99A",
    },

    numero: {
        fontSize: 19,
        fontWeight: "600",
        color: "#111",
        marginTop: 3,
    },

    label: {
        fontSize: 12,
        color: "#111",
        marginTop: 4,
        textAlign: "center",
    },

    tituloLinha: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
    },

    titulo: {
        fontSize: 17,
        fontWeight: "600",
        color: "#111",
        flex: 1,
    },

    verTodos: {
        minHeight: 40,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 6,
        paddingHorizontal: 8,
    },

    textoVerTodos: {
        fontSize: 12,
        color: "#111",
        marginRight: 5,
        fontWeight: "600",
    },

    destaques: {
        marginBottom: 32,
    },

    cardPost: {
        width: 180,
        backgroundColor: "#FFF",
        borderRadius: 15,
        marginRight: 15,
        overflow: "hidden",
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.08,
        shadowRadius: 3,
    },

    imagemPost: {
        width: "100%",
        height: 130,
        backgroundColor: "#D0D0D0",
    },

    imagemPostSemImagem: {
        width: "100%",
        height: 130,
        backgroundColor: "#D0D0D0",
        alignItems: "center",
        justifyContent: "center",
    },

    conteudoPost: {
        padding: 12,
    },

    tituloPost: {
        fontSize: 14,
        fontWeight: "600",
        color: "#111",
        lineHeight: 19,
    },

    descricaoPost: {
        fontSize: 12,
        color: "#666",
        marginTop: 5,
        lineHeight: 17,
    },

    semPosts: {
        height: 170,
        borderRadius: 15,
        backgroundColor: "#E7E5D8",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 32,
    },

    semPostsGrande: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 50,
    },

    semPostsTexto: {
        marginTop: 10,
        fontSize: 14,
        color: "#777",
    },

    contadorPosts: {
        fontSize: 13,
        color: "#777",
        fontWeight: "500",
    },

    postCompleto: {
        backgroundColor: "#FFF",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: 18,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.07,
        shadowRadius: 3,
    },

    imagemPostCompleta: {
        width: "100%",
        height: 210,
        backgroundColor: "#D0D0D0",
    },

    imagemPostCompletaSemImagem: {
        width: "100%",
        height: 210,
        backgroundColor: "#D0D0D0",
        alignItems: "center",
        justifyContent: "center",
    },

    postTexto: {
        padding: 15,
    },

    tituloPostCompleto: {
        fontSize: 18,
        fontWeight: "600",
        color: "#111",
    },

    descricaoPostCompleta: {
        fontSize: 14,
        color: "#555",
        marginTop: 8,
        lineHeight: 20,
    },

    carregando: {
        alignItems: "center",
        paddingVertical: 30,
    },

    carregandoTexto: {
        fontSize: 14,
        marginTop: 10,
        color: "#555",
    },

    cardAvaliacao: {
        minHeight: 85,
        backgroundColor: "#FFF",
        borderRadius: 42,
        marginHorizontal: -4,
        marginBottom: 14,
        paddingHorizontal: 15,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },

    avatarCliente: {
        width: 56,
        height: 56,
        borderRadius: 30,
        backgroundColor: "#D6D6D6",
        alignItems: "center",
        justifyContent: "center",
    },

    dadosAvaliacao: {
        flex: 1,
        marginLeft: 14,
    },

    nomeCliente: {
        fontSize: 15,
        fontWeight: "600",
        color: "#111",
    },

    estrelas: {
        flexDirection: "row",
        marginTop: 4,
        gap: 2,
    },

    tituloAvaliacao: {
        fontSize: 13,
        color: "#555",
        marginTop: 5,
    },

    nota: {
        fontSize: 16,
        fontWeight: "600",
        color: "#555",
        marginRight: 8,
    },

    semAvaliacoesContainer: {
        alignItems: "center",
        paddingVertical: 35,
    },

    semAvaliacoes: {
        textAlign: "center",
        fontSize: 15,
        color: "#555",
        marginTop: 10,
    },

    botaoVerMais: {
        backgroundColor: "#ACCCB1",
        borderRadius: 28,
        minHeight: 55,
        paddingHorizontal: 20,
        marginHorizontal: -4,
        marginTop: 5,
        marginBottom: 25,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
    },

    botaoVerMaisTexto: {
        fontSize: 14,
        fontWeight: "600",
        color: "#111",
        marginRight: 8,
    },

    conteudoAba: {
        alignItems: "center",
        paddingVertical: 50,
    },

    tituloAba: {
        fontSize: 22,
        fontWeight: "600",
        color: "#111",
        marginBottom: 10,
    },

    textoAba: {
        fontSize: 15,
        color: "#555",
        textAlign: "center",
    },

    infoOrganizacao: {
        marginTop: 25,
        backgroundColor: "#ACCCB1",
        borderRadius: 20,
        padding: 20,
        width: "100%",
    },

    infoOrganizacaoTexto: {
        fontSize: 15,
        color: "#111",
        marginBottom: 8,
    },

    mediaContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#ACCCB1",
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginLeft: 10,
    },

    mediaTexto: {
        fontSize: 14,
        fontWeight: "600",
        color: "#111",
        marginLeft: 5,
    },

    resumoAvaliacoes: {
        alignItems: "center",
        paddingVertical: 20,
        marginBottom: 20,
    },

    resumoTexto: {
        fontSize: 13,
        color: "#777",
    },
});
