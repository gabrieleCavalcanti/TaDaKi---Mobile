import React, { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    Linking,
    Share,
    Alert,
    Animated,
    Easing,
    Modal,
    TextInput,
    Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import api, { imageUrl } from "../../api/api";

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
    id_organizacao?: number;
    cpf?: string;
    cnpj?: string;
    data_criacao?: string;
    email?: string;
    telefone?: string;
    endereco?: string;
    logradouro?: string;
    numero?: string | number;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
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

interface ContatoPerfil { id_contato: number; email: string | null; telefone: string | null; principal?: number | boolean; }
interface EnderecoPerfil { id_endereco: number; rua: string; numero: string; bairro: string; municipio: string; cep: string; uf: string; complemento?: string | null; principal?: number | boolean; }
const enderecoVazio = { rua: "", numero: "", bairro: "", municipio: "", cep: "", uf: "", complemento: "" };
const formatarTelefone = (valor: string) => { const d = valor.replace(/\D/g, ""); return d.length === 11 ? `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}` : valor; };

// Extrai registros dos formatos de resposta usados pelas rotas /pessoas.
function extrairPessoas(valor: any, nivel = 0): any[] {
    if (!valor || nivel > 5) return [];
    if (Array.isArray(valor)) return valor.flatMap(item => extrairPessoas(item, nivel + 1));
    if (typeof valor !== "object") return [];
    const resultado = valor.id_pessoa != null || valor.id_cliente != null || valor.id_organizacao != null ? [valor] : [];
    for (const chave of ["pessoaId", "pessoas", "pessoa", "funcionarios", "dados", "data", "resultado", "cliente", "clientes", "organizacao", "organizacoes"]) {
        if (valor[chave] != null) resultado.push(...extrairPessoas(valor[chave], nivel + 1));
    }
    return resultado;
}

type Aba = "inicio" | "arquivados" | "posts" | "avaliacoes";

export default function PerfilScreen({ route, navigation }: any) {
    const idPessoa = Number(route?.params?.id_pessoa);
    const insets = useSafeAreaInsets();

    const idPessoaLogada = Number(route?.params?.id_pessoa_login ?? route?.params?.usuario?.id_pessoa_login ?? route?.params?.user?.id_pessoa_login);
    const [contaLogada, setContaLogada] = useState<{ id: number; tipo: string; idCliente: number } | null>(null);
    // A permissão é definida pela conta autenticada, nunca pelo perfil visitado.
    const dono = contaLogada?.tipo === "ORGANIZACAO" && contaLogada.id === idPessoa;
    const clienteLogado = contaLogada?.tipo === "CLIENTE";

    useEffect(() => {
        let ativo = true;
        async function identificarConta() {
            try {
                const { data } = await api.get("/auth/me");
                const usuario = data?.user ?? data;
                const id = Number(usuario?.id_pessoa ?? usuario?.id_pessoa_login);
                const tipo = String(usuario?.tipo ?? usuario?.tipo_usuario ?? usuario?.tipo_pessoa ?? "").trim().toUpperCase();
                if (!Number.isSafeInteger(id) || id <= 0 || !tipo) throw new Error("Resposta de autenticação incompleta");
                let idCliente = Number(usuario?.id_cliente ?? 0);
                if (tipo === "CLIENTE" && !idCliente) {
                    const { data: resposta } = await api.get("/pessoas", { params: { id } });
                    const pessoa = extrairPessoas(resposta).find((p: any) =>
                        Number(p.id_pessoa) === id && Number(p.id_cliente ?? p.cliente?.id_cliente) > 0);
                    idCliente = Number(pessoa?.id_cliente ?? pessoa?.cliente?.id_cliente ?? 0);
                }
                if (ativo) setContaLogada({ id, tipo, idCliente });
            } catch (erro) {
                console.error("Não foi possível identificar a conta autenticada:", erro);
                // Algumas versões do backend não expõem /auth/me. Recupera a identidade
                // do usuário da navegação, sem confundir com o perfil visitado.
                const usuario = route?.params?.usuarioLogado ?? route?.params?.usuario ?? route?.params?.user;
                const id = Number(usuario?.id_pessoa ?? usuario?.id_pessoa_login ?? idPessoaLogada);
                const tipo = String(usuario?.tipo ?? usuario?.tipo_usuario ?? route?.params?.tipo_usuario ?? "").toUpperCase();
                const idCliente = Number(usuario?.id_cliente ?? route?.params?.id_cliente ?? 0);
                if (ativo) setContaLogada(id > 0 && (tipo === "CLIENTE" || tipo === "ORGANIZACAO") ? { id, tipo, idCliente } : null);
            } finally {
                // A identificação pode ser refeita ao retornar à tela.
            }
        }
        identificarConta();
        return () => { ativo = false; };
    }, []);
    const [editando, setEditando] = useState(false);
    const [nomeEditado, setNomeEditado] = useState("");
    const [contatos, setContatos] = useState<ContatoPerfil[]>([]);
    const [enderecos, setEnderecos] = useState<EnderecoPerfil[]>([]);
    const [enderecoPreferidoId, setEnderecoPreferidoId] = useState<number | null>(null);
    const [modalNovoContato, setModalNovoContato] = useState<"email" | "telefone" | null>(null);
    const [novoContato, setNovoContato] = useState("");
    const [adicionandoEndereco, setAdicionandoEndereco] = useState(false);
    const [novoEndereco, setNovoEndereco] = useState({ ...enderecoVazio });
    const [buscandoCep, setBuscandoCep] = useState(false);
    const [erroEdicao, setErroEdicao] = useState("");
    const [carregandoInformacoes, setCarregandoInformacoes] = useState(false);

    const [salvando, setSalvando] = useState(false);
    const [arquivados, setArquivados] = useState<IPost[]>([]);
    const [loadingArquivados, setLoadingArquivados] = useState(false);
    const [erroArquivados, setErroArquivados] = useState("");
    const [desarquivandoId, setDesarquivandoId] = useState<number | null>(null);
    const [organizacao, setOrganizacao] =
        useState<IOrganizacao | null>(null);

    const [categoria, setCategoria] = useState(NA);
    const [posts, setPosts] = useState<IPost[]>([]);
    const [avaliacoes, setAvaliacoes] = useState<IAvaliacao[]>([]);

    const [loading, setLoading] = useState(true);
    const [loadingPosts, setLoadingPosts] = useState(false);
    const [buscaPosts, setBuscaPosts] = useState("");
    const [menuPostId, setMenuPostId] = useState<number | null>(null);
    const [postEmEdicao, setPostEmEdicao] = useState<IPost | null>(null);
    const [tituloPostEditado, setTituloPostEditado] = useState("");
    const [descricaoPostEditada, setDescricaoPostEditada] = useState("");
    const [salvandoPost, setSalvandoPost] = useState(false);
    const [arquivandoPostId, setArquivandoPostId] = useState<number | null>(null);
    const [abaSelecionada, setAbaSelecionada] =
        useState<Aba>("inicio");

    const media = calcularMediaAvaliacoes(avaliacoes);
    const [favoritado, setFavoritado] = useState(false);
    const [likesPosts, setLikesPosts] = useState<Record<number, {curtiu: boolean; totalLikes: number}>>({});
    const [likesCarregando, setLikesCarregando] = useState<Record<number, boolean>>({});
    const [carregandoFavorito, setCarregandoFavorito] = useState(false);
    const [menuAberto, setMenuAberto] = useState(false);
    const [modalAvaliacaoAberto, setModalAvaliacaoAberto] = useState(false);
    const [notaSelecionada, setNotaSelecionada] = useState(0);
    const [tituloAvaliacao, setTituloAvaliacao] = useState("");
    const [comentarioAvaliacao, setComentarioAvaliacao] = useState("");
    const [avaliacaoAnonima, setAvaliacaoAnonima] = useState(false);
    const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false);
    const [erroAvaliacao, setErroAvaliacao] = useState("");
    const [mapaCarregando, setMapaCarregando] = useState(false);
    const animacaoEntrada = useRef(new Animated.Value(0)).current;
    const pulsoMapa = useRef(new Animated.Value(0)).current;
    const animacaoNumeros = useRef(new Animated.Value(0)).current;
    const [progressoNumeros, setProgressoNumeros] = useState(0);
    const idCliente = clienteLogado ? contaLogada!.idCliente : 0;
    useEffect(() => {
        if (!clienteLogado || idCliente > 0 || !contaLogada?.id) return;
        let ativo = true;
        api.get("/pessoas", { params: { id: contaLogada.id } }).then(({data}) => {
            const pessoa = extrairPessoas(data).find((x: any) =>
                Number(x.id_pessoa) === contaLogada.id && Number(x.id_cliente ?? x.cliente?.id_cliente) > 0);
            const id = Number(pessoa?.id_cliente ?? pessoa?.cliente?.id_cliente);
            if (ativo && id > 0) setContaLogada(prev => prev ? {...prev, idCliente: id} : prev);
        }).catch(error => console.warn("Não foi possível identificar o cadastro de cliente:", error));
        return () => { ativo = false; };
    }, [clienteLogado, idCliente, contaLogada?.id]);
    useEffect(() => {
        if (!posts.length) { setLikesPosts({}); return; }
        let ativo = true;
        Promise.all(posts.filter(p => p.id_post).map(async p => {
            const id = Number(p.id_post);
            try {
                const [contagem, verificacao] = await Promise.all([
                    api.get('/likes/contar', {params: {id_post: id}}),
                    clienteLogado ? api.get('/likes/verificar', {params: {id_post: id}}).catch(() => ({data: {curtiu: false}})) : Promise.resolve({data: {curtiu: false}})
                ]);
                return {id, curtiu: Boolean(verificacao.data?.curtiu), totalLikes: Number(contagem.data?.total ?? 0)};
            } catch { return null; }
        })).then(resultados => {
            if (!ativo) return;
            const novos: Record<number, {curtiu: boolean; totalLikes: number}> = {};
            resultados.forEach(item => {if(item) novos[item.id] = {curtiu:item.curtiu,totalLikes:item.totalLikes};});
            setLikesPosts(novos);
        });
        return () => {ativo = false;};
    }, [posts, clienteLogado]);
    async function alternarCurtida(idPost?: number) {
        const id = Number(idPost);
        if (!id || likesCarregando[id]) return;
        if (!clienteLogado) { Alert.alert('Curtir publicação', 'Entre com uma conta de cliente para curtir.'); return; }
        setLikesCarregando(prev => ({...prev, [id]:true}));
        try {
            const {data} = await api.post('/likes/toggle', {id_post:id});
            setLikesPosts(prev => ({...prev, [id]:{curtiu:Boolean(data?.curtiu),totalLikes:Number(data?.totalLikes ?? prev[id]?.totalLikes ?? 0)}}));
        } catch (e:any) {Alert.alert('Não foi possível curtir', e?.response?.data?.message ?? 'Verifique sua sessão e tente novamente.');}
        finally {setLikesCarregando(prev => ({...prev,[id]:false}));}
    }
    function BotaoCurtir({post}:{post:IPost}) {
        const id = Number(post.id_post); const info = likesPosts[id];
        return <TouchableOpacity accessibilityRole="button" disabled={!id || !!likesCarregando[id]} onPress={() => alternarCurtida(id)} style={styles.botaoCurtirNovo}>
            <Ionicons name={info?.curtiu ? 'heart' : 'heart-outline'} size={18} color="#B01013" />
            <Text style={styles.botaoCurtirTextoNovo}>{info?.curtiu ? 'Curtido' : 'Curtir'} {info?.totalLikes ?? 0}</Text>
        </TouchableOpacity>;
    }

    useEffect(() => {
        Animated.timing(animacaoEntrada, {
            toValue: 1, duration: 380, easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [animacaoEntrada]);

    useEffect(() => {
        const loop = Animated.loop(Animated.sequence([
            Animated.timing(pulsoMapa, { toValue: 1, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(pulsoMapa, { toValue: 0, duration: 700, useNativeDriver: true }),
        ]));
        loop.start();
        return () => loop.stop();
    }, [pulsoMapa]);

    useEffect(() => {
        animacaoNumeros.setValue(0);
        const listener = animacaoNumeros.addListener(({ value }) => setProgressoNumeros(value));
        Animated.timing(animacaoNumeros, { toValue: 1, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
        return () => { animacaoNumeros.removeListener(listener); animacaoNumeros.stopAnimation(); };
    }, [posts.length, avaliacoes.length, media, animacaoNumeros]);

    useEffect(() => {
        let ativo = true;
        if (!clienteLogado || !idCliente || !organizacao?.id_organizacao) return;
        api.get("/Favoritos", { params: { id_cliente: idCliente } })
            .then(({ data }) => {
                if (ativo) setFavoritado((data?.favoritos ?? data?.dados ?? []).some((f: any) =>
                    Number(f.id_organizacao) === Number(organizacao?.id_organizacao)));
            }).catch(() => { });
        return () => { ativo = false; };
    }, [clienteLogado, idCliente, idPessoa, organizacao?.id_organizacao]);

    async function alternarFavorito() {
        if (!clienteLogado || !idCliente) {
            Alert.alert("Entre como cliente", "Para favoritar, abra o perfil com sua conta de cliente.");
            return;
        }
        if (carregandoFavorito) return;
        setCarregandoFavorito(true);
        try {
            const { data } = await api.get("/Favoritos", { params: { id_cliente: idCliente } });
            const existente = (data?.favoritos ?? data?.dados ?? []).find((f: any) =>
                Number(f.id_organizacao) === Number(organizacao?.id_organizacao));
            if (existente) {
                await api.delete(`/Favoritos/${existente.id_favorito}`);
                setFavoritado(false);
            } else {
                await api.post("/Favoritos", { id_cliente: idCliente, id_organizacao: Number(organizacao?.id_organizacao) });
                setFavoritado(true);
            }
        } catch (e: any) {
            Alert.alert("Favoritos", e?.response?.data?.message ?? "Não foi possível atualizar o favorito.");
        } finally { setCarregandoFavorito(false); }
    }


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
                setAvaliacoes([]);
                return;
            }
            const idOrganizacao = await carregarOrganizacao(pessoa);
            await Promise.all([
                carregarAvaliacoes(idOrganizacao),
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
            const resposta = await api.get("/pessoas", { params: { id: idPessoa } });
            const lista = resposta.data?.pessoaId ?? resposta.data?.pessoas ?? resposta.data?.data ?? [];
            const pessoa = Array.isArray(lista)
                ? lista.find((item: IPessoa) => Number(item.id_pessoa) === idPessoa)
                : resposta.data?.pessoa;
            return pessoa && Number(pessoa.id_pessoa) === idPessoa ? pessoa : null;
        } catch (error) {
            console.error("Erro ao buscar pessoa:", error);
            return null;
        }
    }
    async function carregarInformacoes() {
        if (!idPessoa) return;
        setCarregandoInformacoes(true);
        const [resC, resE] = await Promise.allSettled([
            api.get("/contatos", { params: { id_pessoa: idPessoa } }),
            api.get("/enderecos", { params: { id_pessoa: idPessoa } }),
        ]);
        if (resC.status === "fulfilled") {
            const lista = resC.value.data?.contatoPessoa ?? [];
            setContatos(Array.isArray(lista) ? lista : []);
        } else console.warn("Não foi possível buscar contatos", resC.reason);
        if (resE.status === "fulfilled") {
            const lista: EnderecoPerfil[] = resE.value.data?.enderecoPessoa ?? [];
            const validos = Array.isArray(lista) ? lista : [];
            setEnderecos(validos);
            const salvo = Number(await AsyncStorage.getItem(`tadaki-endereco-preferido-${idPessoa}`));
            setEnderecoPreferidoId(validos.some(e => Number(e.id_endereco) === salvo) ? salvo : (validos[0]?.id_endereco ?? null));
        } else console.warn("Não foi possível buscar endereços", resE.reason);
        setCarregandoInformacoes(false);
    }

    useEffect(() => { if (idPessoa > 0) carregarInformacoes(); }, [idPessoa]);

    const contatoEmail = contatos.find(c => c.email && c.principal)?.email ?? contatos.find(c => c.email)?.email ?? organizacao?.email ?? "";
    const contatoTelefone = contatos.find(c => c.telefone && c.principal)?.telefone ?? contatos.find(c => c.telefone)?.telefone ?? organizacao?.telefone ?? "";
    const enderecoAtual = enderecos.find(e => Number(e.id_endereco) === Number(enderecoPreferidoId)) ?? enderecos[0];
    const textoEndereco = enderecoAtual
        ? [enderecoAtual.rua, enderecoAtual.numero, enderecoAtual.bairro, enderecoAtual.municipio, enderecoAtual.uf, enderecoAtual.cep].filter(Boolean).join(", ")
        : [organizacao?.endereco || organizacao?.logradouro, organizacao?.numero, organizacao?.bairro, organizacao?.cidade, organizacao?.estado, organizacao?.cep].filter(Boolean).join(", ");

    async function tornarContatoPrincipal(contato: ContatoPerfil) {
        setSalvando(true); setErroEdicao("");
        try {
            await api.put(`/contatos/principal?id=${contato.id_contato}`, { id_pessoa: idPessoa });
            await carregarInformacoes();
        } catch (e: any) { setErroEdicao(e?.response?.data?.message ?? "Não foi possível alterar o contato principal."); }
        finally { setSalvando(false); }
    }

    async function cadastrarContato() {
        const valor = novoContato.trim();
        if (!modalNovoContato) return;
        if (modalNovoContato === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) { setErroEdicao("Informe um e-mail válido."); return; }
        if (modalNovoContato === "telefone" && ![10,11].includes(valor.replace(/\D/g, "").length)) { setErroEdicao("Informe telefone com DDD (10 ou 11 números)."); return; }
        setSalvando(true); setErroEdicao("");
        try {
            const { data } = await api.post("/contatos", { id_pessoa: idPessoa, email: modalNovoContato === "email" ? valor : null, telefone: modalNovoContato === "telefone" ? valor.replace(/\D/g, "") : null });
            const novoId = Number(data?.novo?.insertId ?? data?.novo?.id_contato);
            const jaExistia = contatos.some(c => modalNovoContato === "email" ? !!c.email : !!c.telefone);
            if (!jaExistia && novoId > 0) await api.put(`/contatos/principal?id=${novoId}`, { id_pessoa: idPessoa });
            setModalNovoContato(null); setNovoContato(""); await carregarInformacoes();
        } catch (e: any) { setErroEdicao(e?.response?.data?.message ?? "Não foi possível adicionar o contato."); }
        finally { setSalvando(false); }
    }

    async function escolherEndereco(id: number) {
        setEnderecoPreferidoId(id);
        await AsyncStorage.setItem(`tadaki-endereco-preferido-${idPessoa}`, String(id));
    }

    async function preencherCep() {
        const cep = novoEndereco.cep.replace(/\D/g, "");
        if (cep.length !== 8) { setErroEdicao("Digite um CEP com 8 números."); return; }
        setBuscandoCep(true); setErroEdicao("");
        try {
            const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const d = await r.json();
            if (!r.ok || d.erro) throw new Error("CEP não encontrado.");
            setNovoEndereco(e => ({ ...e, cep, rua: d.logradouro || e.rua, bairro: d.bairro || e.bairro, municipio: d.localidade || e.municipio, uf: d.uf || e.uf }));
        } catch { setErroEdicao("Não foi possível consultar o CEP."); }
        finally { setBuscandoCep(false); }
    }

    async function cadastrarEndereco() {
        const e = novoEndereco;
        if (!e.rua.trim() || !e.numero.trim() || !e.bairro.trim() || !e.municipio.trim() || !/^[a-z]{2}$/i.test(e.uf.trim()) || e.cep.replace(/\D/g, "").length !== 8) {
            setErroEdicao("Preencha CEP, rua, número, bairro, cidade e UF."); return;
        }
        setSalvando(true); setErroEdicao("");
        try {
            const { data } = await api.post("/enderecos", { ...e, cep: e.cep.replace(/\D/g, ""), uf: e.uf.toUpperCase(), id_pessoa: idPessoa });
            const novoId = Number(data?.novo?.insertId ?? data?.novo?.id_endereco);
            await carregarInformacoes();
            if (novoId > 0) await escolherEndereco(novoId);
            setAdicionandoEndereco(false); setNovoEndereco({ ...enderecoVazio });
        } catch (err: any) { setErroEdicao(err?.response?.data?.message ?? "Não foi possível adicionar o endereço."); }
        finally { setSalvando(false); }
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

            const encontrada = extrairPessoas(resposta.data).find(
                (item: IOrganizacao) => Number(item.id_pessoa) === idPessoa && Number(item.id_organizacao) > 0
            );

            if (!encontrada) {
                setOrganizacao(organizacaoBasica);
                setCategoria(NA);
                return 0;
            }

            setOrganizacao(encontrada);

            if (encontrada.id_area_atuacao) {
                await carregarCategoria(
                    encontrada.id_area_atuacao
                );
            } else {
                setCategoria(NA);
            }
            return Number(encontrada.id_organizacao) || 0;
        } catch (error) {
            console.error("Erro ao buscar organização:", error);

            setOrganizacao(organizacaoBasica);
            setCategoria(NA);
            return 0;
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

    async function carregarAvaliacoes(idOrganizacao = Number(organizacao?.id_organizacao)) {
        // Nunca consultar sem ID: isso poderia misturar avaliações de organizações.
        if (!Number.isSafeInteger(idOrganizacao) || idOrganizacao <= 0) {
            setAvaliacoes([]);
            return;
        }
        try {
            const resultado = await buscarAvaliacoesPorOrganizacao(idOrganizacao);
            setAvaliacoes(resultado.filter(item => Number(item.id_organizacao) === idOrganizacao));
        } catch (error) {
            console.error("Erro ao buscar avaliações desta organização:", error);
            setAvaliacoes([]);
        }
    }

    async function carregarPosts() {
        try {
            setLoadingPosts(true);

            const respostaOrganizacoes = await api.get("/pessoas?tipo=ORGANIZACAO");
            const listaOrganizacoes = respostaOrganizacoes.data?.funcionarios ?? respostaOrganizacoes.data?.pessoas ?? respostaOrganizacoes.data?.data ?? [];
            const idOrganizacao = Number(listaOrganizacoes.find((item: IOrganizacao) => Number(item.id_pessoa) === idPessoa)?.id_organizacao);
            if (!idOrganizacao) throw new Error("Organização não encontrada para este perfil.");
            const resposta = await api.get(
                "/posts/organizacao",
                {
                    params: {
                        id_organizacao: idOrganizacao,
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
        return imageUrl(nome);
    }

    const enderecoOrganizacao = textoEndereco;

    async function abrirMapa() {
        if (!enderecoOrganizacao) {
            Alert.alert("Localização indisponível", "Esta organização ainda não informou um endereço.");
            return;
        }
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoOrganizacao)}`;
        try {
            setMapaCarregando(true);
            await Linking.openURL(url);
        } catch { Alert.alert("Não foi possível abrir o Google Maps."); }
        finally { setMapaCarregando(false); }
    }

    async function compartilharPerfil() {
        try {
            await Share.share({ message: `Conheça ${organizacao?.nome || "esta organização"} no TaDaKi!${enderecoOrganizacao ? `\nEndereço: ${enderecoOrganizacao}` : ""}` });
        } catch { Alert.alert("Não foi possível compartilhar o perfil."); }
    }

    async function enviarAvaliacao() {
        setErroAvaliacao("");
        if (!clienteLogado) {
            setErroAvaliacao("Entre como cliente para publicar uma avaliação."); return;
        }
        if (!Number.isSafeInteger(idCliente) || idCliente <= 0) {
            setErroAvaliacao("Não foi possível identificar seu cadastro de cliente. Entre novamente na conta."); return;
        }
        if (notaSelecionada < 1 || notaSelecionada > 5) {
            setErroAvaliacao("Selecione uma nota de 1 a 5."); return;
        }
        if (tituloAvaliacao.trim().length < 5 || tituloAvaliacao.trim().length > 25) {
            setErroAvaliacao("O título deve ter entre 5 e 25 caracteres."); return;
        }
        if (comentarioAvaliacao.trim().length < 10 || comentarioAvaliacao.trim().length > 45) {
            setErroAvaliacao("O comentário deve ter entre 10 e 45 caracteres."); return;
        }
        const idOrganizacao = Number(organizacao?.id_organizacao);
        if (!idOrganizacao) { setErroAvaliacao("Organização não identificada."); return; }
        setEnviandoAvaliacao(true);
        try {
            await api.post("/Avaliacao", {
                comentario: comentarioAvaliacao.trim(), titulo: tituloAvaliacao.trim(),
                anonimo: avaliacaoAnonima ? 1 : 0, csat: notaSelecionada,
                id_cliente: idCliente, id_organizacao: idOrganizacao,
            });
            setModalAvaliacaoAberto(false);
            setNotaSelecionada(0); setTituloAvaliacao(""); setComentarioAvaliacao("");
            await carregarAvaliacoes(idOrganizacao);
            Alert.alert("Avaliação publicada", "Sua avaliação foi enviada com sucesso.");
        } catch (e: any) {
            setErroAvaliacao(e?.response?.data?.message || "Não foi possível publicar a avaliação.");
        } finally { setEnviandoAvaliacao(false); }
    }

    async function salvarPerfil() {
        if (!dono) return;
        if (!nomeEditado.trim()) return Alert.alert("Nome obrigatório", "Informe o nome da organização.");
        setSalvando(true);
        try {
            await api.patch(`/pessoas?id=${idPessoa}`, {
                nome: nomeEditado.trim(), cpf: organizacao?.cpf, cnpj: organizacao?.cnpj,
                data_criacao: organizacao?.data_criacao?.slice(0, 10),
                id_area_atuacao: organizacao?.id_area_atuacao,
            });
            setOrganizacao(prev => prev ? { ...prev, nome: nomeEditado.trim() } : prev);
            await carregarInformacoes();
            setEditando(false);
            Alert.alert("Perfil atualizado", "Nome salvo com sucesso.");
        } catch (e: any) { Alert.alert("Erro ao salvar", e?.response?.data?.message || "Não foi possível salvar o perfil."); }
        finally { setSalvando(false); }
    }

    async function carregarArquivados() {
        const id = Number(organizacao?.id_organizacao);
        if (!dono || !id) return;
        setLoadingArquivados(true);
        try {
            const { data } = await api.get("/posts/arquivados", { params: { id_organizacao: id } });
            const lista = data?.posts ?? data?.dados ?? data?.data ?? data;
            if (!Array.isArray(lista)) throw new Error("Resposta inválida da API");
            setArquivados(lista.filter((post: IPost) =>
                Number(post.id_organizacao) === id &&
                (!post.status || String(post.status).toUpperCase() === "ARQUIVADO")
            ));
            setErroArquivados("");
        } catch { setErroArquivados("Não foi possível carregar as publicações arquivadas."); }
        finally { setLoadingArquivados(false); }
    }

    async function desarquivar(post: IPost) {
        if (!post.id_post) return;
        setDesarquivandoId(Number(post.id_post));
        try {
            await api.patch(`/posts/desarquivar?id_post=${post.id_post}&id_organizacao=${organizacao?.id_organizacao}`);
            await Promise.all([carregarArquivados(), carregarPosts()]);
            Alert.alert("Publicação restaurada", "A publicação foi desarquivada.");
        } catch { Alert.alert("Erro", "Não foi possível desarquivar a publicação."); }
        finally { setDesarquivandoId(null); }
    }

    function mudarAba(aba: Aba) {
        if (aba === "arquivados") carregarArquivados();
        setAbaSelecionada(aba);
    }

    /* =========================
       COMPONENTES
    ========================= */

    function Loading({ texto }: { texto: string }) {
        return (
            <View style={styles.carregando}>
                <ActivityIndicator size="large" color="#26303C" />
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

    function AvaliacaoCard({ avaliacao }: { avaliacao: IAvaliacao }) {
        const nota = Math.max(0, Math.min(5, Number(avaliacao.csat) || 0));
        const dataOriginal = (avaliacao as IAvaliacao & { data_avaliacao?: string; data_criacao?: string; created_at?: string }).data_avaliacao ??
            (avaliacao as any).data_criacao ?? (avaliacao as any).created_at;
        const dataValida = dataOriginal && !Number.isNaN(new Date(dataOriginal).getTime());
        const dataFormatada = dataValida ? new Date(dataOriginal).toLocaleDateString("pt-BR") : "";
        return (
            <View style={styles.reviewCardNovo}>
                <View style={styles.reviewTopoNovo}>
                    <View style={styles.reviewAvatarNovo}><Ionicons name="person" size={23} color="#B01013" /></View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.reviewNomeNovo} numberOfLines={1}>{Number(avaliacao.anonimo) === 1 ? "Usuário anônimo" : (avaliacao.nome_cliente || "Usuário")}</Text>
                        {!!dataFormatada && <Text style={styles.reviewDataNovo}>{dataFormatada}</Text>}
                    </View>
                    <View style={styles.reviewNotaNovo}>
                        <Ionicons name="star" size={15} color="#D99318" />
                        <Text style={styles.reviewNotaTextoNovo}>{nota}/5</Text>
                    </View>
                </View>
                <View style={styles.reviewEstrelasNovo}>
                    {[1, 2, 3, 4, 5].map(n => <Ionicons key={n} name={n <= nota ? "star" : "star-outline"} size={17} color="#D99318" />)}
                </View>
                {!!avaliacao.titulo && <Text style={styles.reviewTituloNovo}>{avaliacao.titulo}</Text>}
                {!!avaliacao.comentario && <Text style={styles.reviewComentarioNovo}>{avaliacao.comentario}</Text>}
            </View>
        );
    }

    function ResumoAvaliacoes() {
        const total = avaliacoes.length;
        const contagens = [1, 2, 3, 4, 5].map(n => avaliacoes.filter(a => Number(a.csat) === n).length);
        const positivas = contagens[3] + contagens[4];
        const melhorar = contagens[0] + contagens[1];
        return (
            <View style={styles.resumoReviewNovo}>
                <View style={styles.resumoCabecalhoNovo}>
                    <View style={styles.resumoNotaAreaNovo}>
                        <Text style={styles.resumoNotaGrandeNovo}>{media}</Text>
                        <View style={styles.reviewEstrelasNovo}>
                            {[1, 2, 3, 4, 5].map(n => <Ionicons key={n} name={n <= Math.round(Number(String(media).replace(",", "."))) ? "star" : "star-outline"} size={17} color="#D99318" />)}
                        </View>
                        <Text style={styles.reviewDataNovo}>{total} {total === 1 ? "avaliação" : "avaliações"}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 9 }}>
                        {[5, 4, 3, 2, 1].map(n => (
                            <View key={n} style={styles.barraLinhaNovo}>
                                <Text style={styles.barraRotuloNovo}>{n}★</Text>
                                <View style={styles.barraFundoNovo}><View style={[styles.barraPreenchidaNovo, { width: `${total ? (contagens[n - 1] / total) * 100 : 0}%` }]} /></View>
                                <Text style={styles.barraQtdNovo}>{contagens[n - 1]}</Text>
                            </View>
                        ))}
                    </View>
                </View>
                <View style={styles.resumoIndicadoresNovo}>
                    <View style={styles.indicadorNovo}>
                        <Ionicons name="heart" size={20} color="#B01013" />
                        <View style={{ flex: 1 }}><Text style={styles.indicadorValorNovo}>{total ? Math.round(positivas / total * 100) : 0}% positivas</Text><Text style={styles.indicadorDetalheNovo}>Notas de 4 e 5 estrelas</Text></View>
                    </View>
                    <View style={styles.indicadorNovo}>
                        <Ionicons name="star-outline" size={20} color="#B01013" />
                        <View style={{ flex: 1 }}><Text style={styles.indicadorValorNovo}>{melhorar} para melhorar</Text><Text style={styles.indicadorDetalheNovo}>Notas de 1 e 2 estrelas</Text></View>
                    </View>
                </View>
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
                                titulo.toLowerCase().includes("publica")
                                    ? "posts"
                                    : "avaliacoes"
                            )
                        }
                    >
                        <Text style={styles.textoVerTodos}>
                            Ver todos
                        </Text>

                        <Ionicons
                            name="arrow-forward-outline"
                            size={20}
                            color="#26303C"
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
                        icon="document-text-outline"
                        numero={String(posts.length)}
                        texto="Publicações"
                    />

                    <Estatistica
                        icon="chatbubble-outline"
                        numero={String(avaliacoes.length)}
                        texto="Avaliações recebidas"
                    />

                    <Estatistica
                        icon="star-outline"
                        numero={String(media)}
                        texto="Nota média"
                    />
                </View>

                <Text style={styles.subtituloWeb}>{dono ? "Veja como seus posts aparecem para quem visita sua página." : "Descubra novidades, produtos e conteúdos desta organização."}</Text>
                <TituloSecao
                    titulo={dono ? "Suas publicações em destaque" : "Conheça nossas publicações"}
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

                {clienteLogado && (
                    <TouchableOpacity style={styles.criarAvaliacao} onPress={() => setModalAvaliacaoAberto(true)}>
                        <Ionicons name="add" size={20} color="#FFF" />
                        <Text style={styles.criarAvaliacaoTexto}>Criar avaliação</Text>
                    </TouchableOpacity>
                )}
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
                            color="#26303C"
                        />
                    </TouchableOpacity>
                )}
            </View>
        );
    }

    async function abrirContato(tipo: "email" | "telefone") {
        const valor = tipo === "email" ? contatoEmail : contatoTelefone;
        if (!valor) {
            Alert.alert("Contato indisponível", "A organização ainda não informou esse contato.");
            return;
        }
        const url = tipo === "email"
            ? `mailto:${valor.trim()}`
            : `tel:${valor.replace(/[^\d+]/g, "")}`;
        try {
            const suportado = await Linking.canOpenURL(url);
            if (!suportado) throw new Error("Aplicativo indisponível");
            await Linking.openURL(url);
        } catch {
            Alert.alert("Não foi possível abrir", "Verifique se há um aplicativo disponível para esse contato.");
        }
    }

    function AbaPerfil() {
        return (
            <View style={styles.conteudoAba}>
                <Text style={styles.tituloAba}>Sobre a organização</Text>
                <Text style={styles.textoAba}>
                    Conheça mais informações e entre em contato.
                </Text>
                <View style={styles.infoOrganizacao}>
                    <Text style={styles.infoOrganizacaoTexto}>
                        Nome: {organizacao?.nome || NA}
                    </Text>
                    <Text style={styles.infoOrganizacaoTexto}>
                        Área de atuação: {categoria || NA}
                    </Text>
                    {!!organizacao?.cnpj && (
                        <Text style={styles.infoOrganizacaoTexto}>
                            CNPJ: {organizacao.cnpj}
                        </Text>
                    )}
                    {!!contatoEmail && (
                        <TouchableOpacity
                            accessibilityRole="button"
                            onPress={() => abrirContato("email")}
                            style={{ paddingVertical: 10, flexDirection: "row", alignItems: "center" }}
                        >
                            <Ionicons name="mail-outline" size={20} color="#B01013" />
                            <Text style={[styles.infoOrganizacaoTexto, { marginLeft: 10, flexShrink: 1 }]}>
                                {contatoEmail}
                            </Text>
                        </TouchableOpacity>
                    )}
                    {!!contatoTelefone && (
                        <TouchableOpacity
                            accessibilityRole="button"
                            onPress={() => abrirContato("telefone")}
                            style={{ paddingVertical: 10, flexDirection: "row", alignItems: "center" }}
                        >
                            <Ionicons name="call-outline" size={20} color="#B01013" />
                            <Text style={[styles.infoOrganizacaoTexto, { marginLeft: 10 }]}>
                                {formatarTelefone(contatoTelefone)}
                            </Text>
                        </TouchableOpacity>
                    )}
                    {!!enderecoOrganizacao && (
                        <TouchableOpacity
                            accessibilityRole="button"
                            onPress={abrirMapa}
                            style={{ paddingVertical: 10, flexDirection: "row", alignItems: "center" }}
                        >
                            <Ionicons name="location-outline" size={20} color="#B01013" />
                            <Text style={[styles.infoOrganizacaoTexto, { marginLeft: 10, flexShrink: 1 }]}>
                                {enderecoOrganizacao}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    }

    function abrirEdicaoPublicacao(post: IPost) {
        if (!dono || !post.id_post) return;
        setMenuPostId(null);
        setPostEmEdicao(post);
        setTituloPostEditado(post.titulo ?? "");
        setDescricaoPostEditada(post.descricao ?? "");
    }

    async function salvarEdicaoPublicacao() {
        if (!dono || !postEmEdicao?.id_post || salvandoPost) return;
        if (!tituloPostEditado.trim()) return Alert.alert("Título obrigatório", "Informe o título da publicação.");
        setSalvandoPost(true);
        try {
            // A rota Web usa PUT multipart/form-data em /posts?id_post=...
            const form = new FormData();
            form.append("titulo", tituloPostEditado.trim());
            form.append("descricao", descricaoPostEditada.trim());
            form.append("id_categoria", String(postEmEdicao.id_categoria ?? ""));
            form.append("id_organizacao", String(organizacao?.id_organizacao ?? ""));
            await api.put(`/posts?id_post=${postEmEdicao.id_post}`, form, { headers: { "Content-Type": "multipart/form-data" } });
            setPostEmEdicao(null);
            await carregarPosts();
            Alert.alert("Pronto", "Publicação atualizada com sucesso.");
        } catch (e: any) {
            Alert.alert("Erro ao editar", e?.response?.data?.message ?? "Não foi possível editar a publicação.");
        } finally { setSalvandoPost(false); }
    }

    function confirmarArquivamento(post: IPost) {
        if (!dono || !post.id_post) return;
        setMenuPostId(null);
        Alert.alert("Arquivar publicação?", `Deseja arquivar ${post.titulo || "esta publicação"}?`, [
            { text: "Cancelar", style: "cancel" },
            { text: "Arquivar", style: "destructive", onPress: async () => {
                if (!post.id_post) return;
                setArquivandoPostId(post.id_post);
                try {
                    // Mesmo endpoint usado pelo Web para arquivar
                    await api.delete(`/posts?id_post=${post.id_post}`);
                    await carregarPosts();
                    Alert.alert("Publicação arquivada", "Você pode restaurá-la na aba Arquivados.");
                } catch (e: any) {
                    Alert.alert("Erro ao arquivar", e?.response?.data?.message ?? "Não foi possível arquivar a publicação.");
                } finally { setArquivandoPostId(null); }
            } },
        ]);
    }

    function AbaPosts() {
        const encontrados = posts.filter(post => (post.titulo ?? "").toLocaleLowerCase("pt-BR").includes(buscaPosts.trim().toLocaleLowerCase("pt-BR")));
        return (
            <View style={styles.postsSecaoNova}>
                <View style={styles.postsCabecalhoNovo}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.postsTituloNovo}>Publicações da organização</Text>
                        <Text style={styles.postsLegendaNova}>{posts.length} {posts.length === 1 ? "publicação" : "publicações"}</Text>
                    </View>
                </View>
                <View style={styles.postsBuscaNova}>
                    <Ionicons name="search-outline" size={19} color="#B01013" />
                    <TextInput style={styles.postsBuscaInputNova} value={buscaPosts} onChangeText={setBuscaPosts} placeholder="Pesquisar pelo título..." placeholderTextColor="#8C93A0" returnKeyType="search" />
                    {!!buscaPosts && <TouchableOpacity onPress={() => setBuscaPosts("")} accessibilityLabel="Limpar busca"><Ionicons name="close-circle" size={19} color="#8C93A0" /></TouchableOpacity>}
                </View>
                {loadingPosts ? <Loading texto="Carregando publicações..." /> : encontrados.length === 0 ? (
                    <View style={styles.postsVazioNovo}><Ionicons name="search-outline" size={32} color="#A2B9D5" /><Text style={styles.postsLegendaNova}>{buscaPosts ? "Nenhuma publicação encontrada para esta pesquisa." : "Nenhuma publicação encontrada."}</Text></View>
                ) : encontrados.map(post => (
                    <View key={post.id_post} style={styles.postsItemNovo}>
                        <View style={styles.postsItemTopoNovo}>
                            <View style={styles.postsItemIconeNovo}><Ionicons name="home" size={20} color="#B01013" /></View>
                            <View style={{ flex: 1 }}><Text style={styles.postsAutorNovo} numberOfLines={1}>{organizacao?.nome || "Organização"}</Text></View>
                            {dono && <TouchableOpacity style={styles.postsMaisNovo} onPress={() => setMenuPostId(menuPostId === post.id_post ? null : Number(post.id_post))} accessibilityLabel="Opções da publicação"><Ionicons name="ellipsis-vertical" size={22} color="#26303C" /></TouchableOpacity>}
                        </View>
                        {dono && menuPostId === post.id_post && <View style={styles.postsMenuNovo}>
                            <TouchableOpacity style={styles.postsMenuOpcaoNova} onPress={() => abrirEdicaoPublicacao(post)}><Ionicons name="create-outline" size={18} color="#26303C" /><Text style={styles.postsMenuTextoNovo}>Editar publicação</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.postsMenuOpcaoNova} disabled={arquivandoPostId === post.id_post} onPress={() => confirmarArquivamento(post)}><Ionicons name="archive-outline" size={18} color="#B01013" /><Text style={[styles.postsMenuTextoNovo, { color: "#B01013" }]}>Arquivar publicação</Text></TouchableOpacity>
                        </View>}
                        <PostCompleto post={post} />
                        <BotaoCurtir post={post} />
                    </View>
                ))}
            </View>
        );
    }

    function AbaAvaliacoes() {
        return (
            <View style={styles.secaoAvaliacoesNova}>
                <View style={styles.cabecalhoAvaliacoesNovo}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.tituloAvaliacoesNovo}>Avaliações</Text>
                        <Text style={styles.subtituloWeb}>O que os clientes estão dizendo</Text>
                    </View>
                    {clienteLogado && (
                        <TouchableOpacity style={styles.botaoAvaliarNovo} onPress={() => setModalAvaliacaoAberto(true)}>
                            <Ionicons name="create-outline" size={16} color="#FFF" />
                            <Text style={styles.botaoAvaliarTextoNovo}>Avaliar</Text>
                        </TouchableOpacity>
                    )}
                </View>
                {loading ? <Loading texto="Carregando avaliações..." /> : (
                    <>
                        <ResumoAvaliacoes />
                        {avaliacoes.length === 0 ? <SemAvaliacoes /> : avaliacoes.map(a => <AvaliacaoCard key={a.id_avaliacao} avaliacao={a} />)}
                    </>
                )}
            </View>
        );
    }

    function Estatistica({ icon, numero, texto }: { icon: any; numero: string; texto: string }) {
        const valor = Number(String(numero).replace(",", "."));
        const exibido = !Number.isFinite(valor) ? numero : (
            String(numero).includes(",") || !Number.isInteger(valor)
                ? (valor * progressoNumeros).toFixed(1).replace(".", ",")
                : String(Math.round(valor * progressoNumeros))
        );
        return (
            <View style={styles.estatistica}>
                <View style={styles.estatisticaIconeNovo}><Ionicons name={icon} size={22} color="#B01013" /></View>
                <View style={styles.estatisticaConteudoNovo}>
                    <Text style={styles.numero} numberOfLines={1} adjustsFontSizeToFit>{exibido}</Text>
                    <Text style={styles.label} numberOfLines={2}>{texto}</Text>
                </View>
            </View>
        );
    }

    /* =========================
       TELA
    ========================= */

    return (
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
            <Animated.View style={{ flex: 1, opacity: animacaoEntrada, transform: [{ translateY: animacaoEntrada.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {/* Cabeçalho do perfil, seguindo a estrutura de identidade do Web */}
                    <View style={styles.topoWeb}>
                        <View style={styles.topoFerramentas}>
                            <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Voltar">
                                <Ionicons name="arrow-back" size={24} color="#A50910" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setMenuAberto(true)} accessibilityLabel="Opções do perfil">
                                <Ionicons name="ellipsis-horizontal" size={26} color="#A50910" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.identidadeWeb}>
                            <View style={styles.avatarWeb}><Ionicons name="home" size={45} color="#B01013" /></View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.nomeWeb}>{organizacao?.nome || "Organização"}</Text>
                                <Text style={styles.categoriaWeb}>{categoria === NA ? "Organização" : categoria}</Text>
                                {dono && <TouchableOpacity style={styles.editarWeb} onPress={() => { setNomeEditado(organizacao?.nome || ""); setErroEdicao(""); setEditando(true); }}><Ionicons name="pencil" size={15} color="#FFF" /><Text style={styles.editarTextoWeb}>Editar perfil</Text></TouchableOpacity>}
                                {clienteLogado && !dono && (
                                    <TouchableOpacity style={styles.favoritoWeb} onPress={alternarFavorito} disabled={carregandoFavorito} accessibilityRole="button" accessibilityLabel={favoritado ? "Remover dos favoritos" : "Favoritar organização"}>
                                        <Ionicons name={favoritado ? "heart" : "heart-outline"} size={18} color="#A50910" />
                                        <Text style={styles.favoritoWebTexto}>{favoritado ? "Favoritado" : "Favoritar"}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                        <View style={styles.contatosWeb}>
                            {!!contatoEmail && (
                                <TouchableOpacity style={styles.contatoWeb} onPress={() => abrirContato("email")}>
                                    <Ionicons name="mail-outline" size={21} color="#A50910" />
                                    <View style={{ flex: 1 }}><Text style={styles.contatoRotulo}>E-mail</Text><Text style={styles.contatoValor}>{contatoEmail}</Text></View>
                                </TouchableOpacity>
                            )}
                            {!!contatoTelefone && (
                                <TouchableOpacity style={styles.contatoWeb} onPress={() => abrirContato("telefone")}>
                                    <Ionicons name="call-outline" size={21} color="#A50910" />
                                    <View style={{ flex: 1 }}><Text style={styles.contatoRotulo}>Telefone</Text><Text style={styles.contatoValor}>{formatarTelefone(contatoTelefone)}</Text></View>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    <View style={styles.localCompacto}>
                        <View style={styles.localCompactoIcone}>
                            <Animated.View style={{ position: "absolute", width: 38, height: 38, borderRadius: 19, backgroundColor: "#F8CDD3", opacity: pulsoMapa.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), transform: [{ scale: pulsoMapa.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.9] }) }] }} />
                            <Ionicons name="location" size={22} color="#B01013" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.localCompactoTitulo}>Onde nos encontrar</Text>
                            <Text style={styles.localCompactoEndereco} numberOfLines={3}>{enderecoOrganizacao || "Endereço ainda não cadastrado"}</Text>
                        </View>
                        <TouchableOpacity style={[styles.localCompactoBotao, !enderecoOrganizacao && { opacity: .45 }]} disabled={!enderecoOrganizacao || mapaCarregando} onPress={abrirMapa}>
                            <Ionicons name="map-outline" size={17} color="#FFF" /><Text style={styles.localCompactoBotaoTexto}>Ver mapa</Text>
                        </TouchableOpacity>
                    </View>

                    {/* NAVEGAÇÃO */}
                    <View style={styles.areaMenu}>
                        <View style={styles.menuNavegacao}>
                            <BotaoAba aba="inicio" icon="home-outline" />

                            {dono && <BotaoAba aba="arquivados" icon="list-outline" />}
                            <BotaoAba aba="posts" icon="grid-outline" />

                            <BotaoAba aba="avaliacoes" icon="star-outline" />
                        </View>

                        <View style={styles.linha} />

                        {/* CONTEÚDO */}
                        {abaSelecionada === "inicio" && (
                            <AbaInicio />
                        )}

                        {abaSelecionada === "arquivados" && dono && (
                            <View style={styles.secaoArquivadosNova}>
                                <View style={styles.cabecalhoArquivadosNovo}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.tituloAvaliacoesNovo}>Publicações arquivadas</Text>
                                        <Text style={styles.subtituloWeb}>Somente você pode ver estes posts. Restaure quando quiser.</Text>
                                    </View>
                                    <TouchableOpacity onPress={carregarArquivados} accessibilityLabel="Atualizar arquivados" style={styles.atualizarArquivadosNovo}>
                                        <Ionicons name="refresh" size={20} color="#B01013" />
                                    </TouchableOpacity>
                                </View>
                                {loadingArquivados ? <Loading texto="Carregando arquivados..." /> : erroArquivados ? (
                                    <View style={styles.vazioArquivadosNovo}>
                                        <Ionicons name="alert-circle-outline" size={34} color="#B01013" />
                                        <Text style={styles.vazioTextoNovo}>{erroArquivados}</Text>
                                        <TouchableOpacity style={styles.botaoAvaliarNovo} onPress={carregarArquivados}><Text style={styles.botaoAvaliarTextoNovo}>Tentar novamente</Text></TouchableOpacity>
                                    </View>
                                ) : arquivados.length === 0 ? (
                                    <View style={styles.vazioArquivadosNovo}>
                                        <Ionicons name="archive-outline" size={44} color="#A2B9D5" />
                                        <Text style={styles.vazioTituloNovo}>Nenhuma publicação arquivada</Text>
                                        <Text style={styles.vazioTextoNovo}>Os posts arquivados aparecerão aqui.</Text>
                                    </View>
                                ) : arquivados.map((post, i) => (
                                    <View key={post.id_post ?? i} style={styles.arquivadoCardNovo}>
                                        <View style={styles.arquivadoEtiquetaNovo}>
                                            <Ionicons name="archive-outline" size={14} color="#B01013" />
                                            <Text style={styles.arquivadoEtiquetaTextoNovo}>Arquivado</Text>
                                        </View>
                                        <PostCompleto post={post} />
                                        <TouchableOpacity disabled={desarquivandoId === Number(post.id_post)} style={styles.restaurarBotaoNovo} onPress={() => Alert.alert("Restaurar publicação", `Deseja restaurar ${post.titulo || "esta publicação"}?`, [{ text: "Cancelar", style: "cancel" }, { text: "Restaurar", onPress: () => desarquivar(post) }])}>
                                            {desarquivandoId === Number(post.id_post) ? <ActivityIndicator color="#FFF" /> : <><Ionicons name="arrow-undo-outline" size={17} color="#FFF" /><Text style={styles.botaoAvaliarTextoNovo}>Restaurar publicação</Text></>}
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}
                        {abaSelecionada === "posts" && (
                            <AbaPosts />
                        )}

                        {abaSelecionada === "avaliacoes" && (
                            <AbaAvaliacoes />
                        )}
                    </View>
                </ScrollView>
            </Animated.View>
            <Modal transparent visible={!!postEmEdicao && dono} animationType="slide" onRequestClose={() => { if (!salvandoPost) setPostEmEdicao(null); }}>
                <SafeAreaView style={styles.postEdicaoOverlayNova} edges={["top", "bottom"]}>
                    <ScrollView contentContainerStyle={styles.postEdicaoScrollNova} keyboardShouldPersistTaps="handled">
                        <View style={styles.postEdicaoCartaoNovo}>
                            <View style={styles.postsCabecalhoNovo}>
                                <View style={{ flex: 1 }}><Text style={styles.postsTituloNovo}>Editar publicação</Text><Text style={styles.postsLegendaNova}>Atualize o título e a descrição do post.</Text></View>
                                <TouchableOpacity disabled={salvandoPost} onPress={() => setPostEmEdicao(null)}><Ionicons name="close" size={25} color="#B01013" /></TouchableOpacity>
                            </View>
                            <Text style={styles.campoRotuloWeb}>Título *</Text>
                            <TextInput style={styles.campoInputWeb} value={tituloPostEditado} onChangeText={setTituloPostEditado} maxLength={120} editable={!salvandoPost} />
                            <Text style={[styles.campoRotuloWeb, { marginTop: 16 }]}>Descrição</Text>
                            <TextInput style={[styles.campoInputWeb, { minHeight: 120, textAlignVertical: "top" }]} multiline value={descricaoPostEditada} onChangeText={setDescricaoPostEditada} maxLength={2000} editable={!salvandoPost} />
                            <View style={[styles.rodapeModalWeb, { marginTop: 22 }]}>
                                <TouchableOpacity style={styles.cancelarWeb} disabled={salvandoPost} onPress={() => setPostEmEdicao(null)}><Text style={styles.cancelarTextoWeb}>Cancelar</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.enviarWeb} disabled={salvandoPost} onPress={salvarEdicaoPublicacao}>{salvandoPost ? <ActivityIndicator color="#FFF" /> : <Text style={styles.enviarTextoWeb}>Salvar alterações</Text>}</TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </Modal>
            <Modal transparent visible={editando && dono} animationType="slide" onRequestClose={() => { if (!salvando) setEditando(false); }}>
                <SafeAreaView style={styles.edicaoFundo} edges={["top", "bottom"]}>
                    <View style={styles.edicaoCabecalho}>
                        <View style={{ flex: 1 }}><Text style={styles.edicaoTitulo}>Editar perfil</Text><Text style={styles.edicaoSubtitulo}>Atualize as informações que os clientes veem na sua página.</Text></View>
                        <TouchableOpacity disabled={salvando} onPress={() => setEditando(false)}><Ionicons name="close-circle-outline" size={28} color="#B01013" /></TouchableOpacity>
                    </View>
                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.edicaoConteudo}>
                        <Text style={styles.edicaoSecao}>INFORMAÇÕES BÁSICAS</Text>
                        <Text style={styles.campoRotuloWeb}>Nome da organização *</Text>
                        <TextInput style={styles.campoInputWeb} value={nomeEditado} onChangeText={setNomeEditado} maxLength={120} />
                        <Text style={[styles.campoRotuloWeb, { marginTop: 15 }]}>Categoria</Text>
                        <View style={styles.edicaoCampoDesabilitado}><Text style={styles.edicaoCampoDesabilitadoTexto}>{categoria}</Text></View>
                        <View style={styles.edicaoDivisor} />
                        <Text style={styles.edicaoSecao}>CONTATO</Text>
                        <Text style={styles.edicaoAjuda}>O contato marcado como principal aparece no perfil.</Text>
                        {(["email", "telefone"] as const).map(tipo => (
                            <View key={tipo} style={{ marginTop: 15 }}>
                                <Text style={styles.campoRotuloWeb}>{tipo === "email" ? "E-mail" : "Telefone"} *</Text>
                                {contatos.filter(c => tipo === "email" ? !!c.email : !!c.telefone).map(c => (
                                    <TouchableOpacity key={c.id_contato} disabled={salvando} style={styles.edicaoItem} onPress={() => tornarContatoPrincipal(c)}>
                                        <Ionicons name={tipo === "email" ? "mail-outline" : "call-outline"} size={19} color="#B01013" />
                                        <Text style={styles.edicaoItemTexto}>{tipo === "email" ? c.email : formatarTelefone(c.telefone || "")}</Text>
                                        {!!c.principal && <Text style={styles.edicaoPrincipal}>Principal</Text>}
                                        <Ionicons name={c.principal ? "checkmark-circle" : "ellipse-outline"} size={19} color={c.principal ? "#16804A" : "#8994A4"} />
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity style={styles.edicaoAdicionar} onPress={() => { setNovoContato(""); setErroEdicao(""); setModalNovoContato(tipo); }}><Ionicons name="add-circle-outline" size={20} color="#B01013" /><Text style={styles.edicaoAdicionarTexto}>Adicionar {tipo === "email" ? "e-mail" : "telefone"}</Text></TouchableOpacity>
                                {modalNovoContato === tipo && <View style={styles.edicaoNovoBloco}>
                                    <TextInput style={styles.campoInputWeb} placeholder={tipo === "email" ? "novo@email.com" : "(19) 99999-9999"} value={novoContato} onChangeText={setNovoContato} keyboardType={tipo === "email" ? "email-address" : "phone-pad"} autoCapitalize="none" />
                                    <View style={styles.edicaoAcoesLinha}><TouchableOpacity onPress={() => setModalNovoContato(null)} style={styles.cancelarWeb}><Text style={styles.cancelarTextoWeb}>Cancelar</Text></TouchableOpacity><TouchableOpacity disabled={salvando} onPress={cadastrarContato} style={styles.enviarWeb}><Text style={styles.enviarTextoWeb}>Adicionar</Text></TouchableOpacity></View>
                                </View>}
                            </View>
                        ))}
                        <View style={styles.edicaoDivisor} />
                        <Text style={styles.edicaoSecao}>ENDEREÇO</Text>
                        <Text style={styles.edicaoAjuda}>Selecione um endereço cadastrado ou adicione outro.</Text>
                        {enderecos.map(e => (
                            <TouchableOpacity key={e.id_endereco} style={styles.edicaoItem} onPress={() => escolherEndereco(e.id_endereco)}>
                                <Ionicons name="location-outline" size={20} color="#B01013" />
                                <View style={{ flex: 1 }}><Text style={styles.edicaoItemTexto}>{e.rua}, {e.numero}</Text><Text style={styles.edicaoAjuda}>{e.bairro} · {e.municipio}/{e.uf} · CEP {e.cep}</Text></View>
                                {Number(enderecoPreferidoId) === Number(e.id_endereco) && <Text style={styles.edicaoPrincipal}>Principal</Text>}
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.edicaoAdicionar} onPress={() => { setAdicionandoEndereco(!adicionandoEndereco); setErroEdicao(""); }}><Ionicons name={adicionandoEndereco ? "remove-circle-outline" : "add-circle-outline"} size={20} color="#B01013" /><Text style={styles.edicaoAdicionarTexto}>{adicionandoEndereco ? "Fechar endereço" : "Adicionar endereço"}</Text></TouchableOpacity>
                        {adicionandoEndereco && <View style={styles.edicaoNovoBloco}>
                            <View style={styles.edicaoCepLinha}><TextInput style={[styles.campoInputWeb, { flex: 1 }]} value={novoEndereco.cep} onChangeText={cep => setNovoEndereco(e => ({ ...e, cep }))} placeholder="CEP" keyboardType="numeric" maxLength={9} /><TouchableOpacity style={styles.enviarWeb} onPress={preencherCep} disabled={buscandoCep}>{buscandoCep ? <ActivityIndicator color="#FFF" /> : <Text style={styles.enviarTextoWeb}>Confirmar CEP</Text>}</TouchableOpacity></View>
                            {([ ["rua", "Rua"], ["numero", "Número"], ["bairro", "Bairro"], ["municipio", "Cidade"], ["uf", "UF"], ["complemento", "Complemento"] ] as const).map(([chave, rotulo]) => <View key={chave} style={{ marginTop: 12 }}><Text style={styles.campoRotuloWeb}>{rotulo}</Text><TextInput style={styles.campoInputWeb} value={novoEndereco[chave]} onChangeText={valor => setNovoEndereco(e => ({ ...e, [chave]: valor }))} placeholder={rotulo} /></View>)}
                            <TouchableOpacity style={[styles.enviarWeb, { marginTop: 15 }]} disabled={salvando} onPress={cadastrarEndereco}><Text style={styles.enviarTextoWeb}>Salvar novo endereço</Text></TouchableOpacity>
                        </View>}
                        {carregandoInformacoes && <ActivityIndicator color="#B01013" />}
                        {!!erroEdicao && <Text style={styles.erroWeb}>{erroEdicao}</Text>}
                    </ScrollView>
                    <View style={styles.edicaoRodape}><TouchableOpacity style={styles.cancelarWeb} disabled={salvando} onPress={() => setEditando(false)}><Text style={styles.cancelarTextoWeb}>Cancelar</Text></TouchableOpacity><TouchableOpacity style={styles.enviarWeb} disabled={salvando} onPress={salvarPerfil}>{salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.enviarTextoWeb}>Salvar alterações</Text>}</TouchableOpacity></View>
                </SafeAreaView>
            </Modal>

            <Modal
                transparent
                visible={modalAvaliacaoAberto}
                animationType="fade"
                onRequestClose={() => {
                    if (!enviandoAvaliacao) {
                        setModalAvaliacaoAberto(false);
                    }
                }}
            >
                <View style={styles.modalOverlayWeb}>
                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{
                            flexGrow: 1,
                            justifyContent: "center",
                            padding: 18,
                            paddingTop: Math.max(insets.top, 18),
                            paddingBottom: Math.max(insets.bottom, 18),
                        }}
                    >
                        <View style={styles.modalAvaliacaoWeb}>
                            <View style={styles.modalCabecalhoWeb}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalTituloWeb}>
                                        Avaliar organização
                                    </Text>
                                    <Text style={styles.modalSubtituloWeb}>
                                        Compartilhe sua experiência
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    onPress={() => setModalAvaliacaoAberto(false)}
                                    disabled={enviandoAvaliacao}
                                >
                                    <Ionicons
                                        name="close"
                                        size={24}
                                        color="#B01013"
                                    />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.campoRotuloWeb}>
                                Sua nota *
                            </Text>

                            <View style={styles.estrelasInputWeb}>
                                {[1, 2, 3, 4, 5].map((n) => (
                                    <TouchableOpacity
                                        key={n}
                                        onPress={() => setNotaSelecionada(n)}
                                        accessibilityLabel={`${n} estrelas`}
                                    >
                                        <Ionicons
                                            name={
                                                n <= notaSelecionada
                                                    ? "star"
                                                    : "star-outline"
                                            }
                                            size={34}
                                            color="#B01013"
                                        />
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.campoRotuloWeb}>
                                Título da avaliação *
                            </Text>

                            <TextInput
                                value={tituloAvaliacao}
                                onChangeText={setTituloAvaliacao}
                                maxLength={25}
                                placeholder="Título da sua avaliação"
                                style={styles.campoInputWeb}
                            />

                            <Text style={styles.contadorWeb}>
                                {tituloAvaliacao.length}/25
                            </Text>

                            <Text style={styles.campoRotuloWeb}>
                                Comentário *
                            </Text>

                            <TextInput
                                value={comentarioAvaliacao}
                                onChangeText={setComentarioAvaliacao}
                                maxLength={45}
                                multiline
                                placeholder="Conte como foi sua experiência"
                                style={[
                                    styles.campoInputWeb,
                                    {
                                        height: 94,
                                        textAlignVertical: "top",
                                    },
                                ]}
                            />

                            <Text style={styles.contadorWeb}>
                                {comentarioAvaliacao.length}/45
                            </Text>

                            <View style={styles.anonimoWeb}>
                                <Switch
                                    value={avaliacaoAnonima}
                                    onValueChange={setAvaliacaoAnonima}
                                    trackColor={{
                                        true: "#A2B9D5",
                                    }}
                                    thumbColor={
                                        avaliacaoAnonima
                                            ? "#B01013"
                                            : "#DDD"
                                    }
                                />

                                <Text style={styles.anonimoTextoWeb}>
                                    Publicar anonimamente
                                </Text>
                            </View>

                            {!!erroAvaliacao && (
                                <Text style={styles.erroWeb}>
                                    {erroAvaliacao}
                                </Text>
                            )}

                            <View style={styles.rodapeModalWeb}>
                                <TouchableOpacity
                                    style={styles.cancelarWeb}
                                    disabled={enviandoAvaliacao}
                                    onPress={() =>
                                        setModalAvaliacaoAberto(false)
                                    }
                                >
                                    <Text style={styles.cancelarTextoWeb}>
                                        Cancelar
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.enviarWeb}
                                    disabled={enviandoAvaliacao}
                                    onPress={enviarAvaliacao}
                                >
                                    {enviandoAvaliacao ? (
                                        <ActivityIndicator color="#FFF" />
                                    ) : (
                                        <Text style={styles.enviarTextoWeb}>
                                            Publicar avaliação
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            <Modal transparent visible={menuAberto} animationType="fade" onRequestClose={() => setMenuAberto(false)}>
                <View style={styles.fundoModal}>
                    <View style={styles.cartaoModal}>
                        <Text style={styles.tituloModal}>Organização</Text>
                        <TouchableOpacity style={styles.itemModal} onPress={() => { setMenuAberto(false); compartilharPerfil(); }}>
                            <Ionicons name="share-social-outline" size={20} color="#A50910" /><Text style={styles.itemModalTexto}>Compartilhar perfil</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.itemModal} onPress={() => { setMenuAberto(false); abrirMapa(); }}>
                            <Ionicons name="location-outline" size={20} color="#A50910" /><Text style={styles.itemModalTexto}>Ver localização</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.fecharModal} onPress={() => setMenuAberto(false)}><Text style={styles.fecharModalTexto}>Fechar</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );

    function BotaoAba({ aba, icon }: { aba: Aba; icon: any }) {
        const selecionada = abaSelecionada === aba;
        const rotulos: Record<Aba, string> = { inicio: "Início", arquivados: "Arquivados", posts: "Publicações", avaliacoes: "Avaliações" };
        return <TouchableOpacity style={[styles.abaWeb, selecionada && styles.abaAtivaWeb]} onPress={() => mudarAba(aba)} accessibilityRole="tab" accessibilityState={{ selected: selecionada }}>
            <Ionicons name={icon} size={15} color={selecionada ? "#FFF" : "#667C9A"} />
            <Text style={[styles.rotuloAbaWeb, selecionada && { color: "#FFF" }]} numberOfLines={1}>{rotulos[aba]}</Text>
        </TouchableOpacity>;
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
                    color="#26303C"
                />

                <Text style={styles.infoTexto}>
                    {texto}
                </Text>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    botaoCurtirNovo: { alignSelf: "flex-start", marginHorizontal: 15, marginBottom: 16, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22, borderWidth: 1, borderColor: "#F4CFD4", backgroundColor: "#FFF0F2", flexDirection: "row", alignItems: "center", gap: 7 },
    botaoCurtirTextoNovo: { color: "#B01013", fontWeight: "700", fontSize: 13 },
    localCompacto: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12, backgroundColor: "#FFF", marginHorizontal: 16, marginTop: 18, marginBottom: 8, borderRadius: 19, borderWidth: 1, borderColor: "#F0DFE1", padding: 17 },
    localCompactoIcone: { backgroundColor: "#FCECEF", padding: 10, borderRadius: 12 },
    localCompactoTitulo: { fontSize: 12, fontWeight: "800", color: "#B01013", marginBottom: 3 },
    localCompactoEndereco: { fontSize: 12, color: "#273043", lineHeight: 17 },
    localCompactoBotao: { backgroundColor: "#B01013", width: "100%", minHeight: 43, flexDirection: "row", justifyContent: "center", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", gap: 8 },
    localCompactoBotaoTexto: { color: "#FFF", fontWeight: "800", fontSize: 11 },
    edicaoFundo: { flex: 1, backgroundColor: "#FFF" },
    edicaoCabecalho: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: "#F0E4E6" },
    edicaoTitulo: { fontSize: 23, color: "#1C2433", fontWeight: "800" },
    edicaoSubtitulo: { color: "#748094", fontSize: 12, marginTop: 4 },
    edicaoConteudo: { padding: 20, paddingBottom: 35 },
    edicaoSecao: { fontSize: 13, color: "#B01013", fontWeight: "900", marginBottom: 14 },
    edicaoAjuda: { fontSize: 12, color: "#788394", marginTop: 4 },
    edicaoDivisor: { height: 1, backgroundColor: "#F0E4E6", marginVertical: 22 },
    edicaoCampoDesabilitado: { backgroundColor: "#FAF6F7", borderColor: "#E9D6D9", borderWidth: 1, borderRadius: 11, padding: 13 },
    edicaoCampoDesabilitadoTexto: { color: "#777", fontSize: 14 },
    edicaoItem: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#E2E8EF", backgroundColor: "#FAFBFC", borderRadius: 12, padding: 12, marginTop: 9 },
    edicaoItemTexto: { flex: 1, fontWeight: "700", color: "#1C2433", fontSize: 13 },
    edicaoPrincipal: { color: "#16804A", fontSize: 10, fontWeight: "800", backgroundColor: "#E8F7ED", borderRadius: 9, paddingHorizontal: 7, paddingVertical: 4, overflow: "hidden" },
    edicaoAdicionar: { flexDirection: "row", gap: 7, alignItems: "center", alignSelf: "flex-start", paddingVertical: 13 },
    edicaoAdicionarTexto: { color: "#B01013", fontSize: 13, fontWeight: "700" },
    edicaoNovoBloco: { padding: 12, borderWidth: 1, borderColor: "#F1DADC", borderRadius: 12, backgroundColor: "#FFFBFB" },
    edicaoAcoesLinha: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 12 },
    edicaoCepLinha: { flexDirection: "row", alignItems: "center", gap: 9 },
    edicaoRodape: { flexDirection: "row", gap: 10, justifyContent: "flex-end", padding: 15, borderTopWidth: 1, borderTopColor: "#EDE4E6" },

    secaoAvaliacoesNova: { backgroundColor: "#FFF", borderRadius: 20, padding: 15, marginBottom: 24, borderWidth: 1, borderColor: "#F0E7E8" },
    cabecalhoAvaliacoesNovo: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
    tituloAvaliacoesNovo: { fontSize: 21, fontWeight: "800", color: "#1C2433", marginBottom: 4 },
    botaoAvaliarNovo: { backgroundColor: "#B01013", borderRadius: 12, minHeight: 42, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    botaoAvaliarTextoNovo: { color: "#FFF", fontWeight: "700", fontSize: 12 },
    resumoReviewNovo: { borderRadius: 17, borderWidth: 1, borderColor: "#F4D5D9", backgroundColor: "#FFFBFB", padding: 14, marginBottom: 18 },
    resumoCabecalhoNovo: { flexDirection: "row", alignItems: "center", gap: 15 },
    resumoNotaAreaNovo: { width: 91, alignItems: "flex-start" },
    resumoNotaGrandeNovo: { color: "#B01013", fontSize: 44, fontWeight: "900", lineHeight: 53 },
    barraLinhaNovo: { flexDirection: "row", alignItems: "center", gap: 6 },
    barraRotuloNovo: { width: 23, fontSize: 11, fontWeight: "700", color: "#64748B" },
    barraFundoNovo: { height: 7, backgroundColor: "#EFE3E6", borderRadius: 10, flex: 1, overflow: "hidden" },
    barraPreenchidaNovo: { height: "100%", backgroundColor: "#B01013", borderRadius: 10 },
    barraQtdNovo: { width: 17, textAlign: "right", fontSize: 11, color: "#64748B" },
    resumoIndicadoresNovo: { marginTop: 16, gap: 8 },
    indicadorNovo: { flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 12, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#F0E3E5", padding: 11 },
    indicadorValorNovo: { color: "#B01013", fontSize: 14, fontWeight: "800" },
    indicadorDetalheNovo: { color: "#6B7280", fontSize: 11, marginTop: 2 },
    reviewCardNovo: { backgroundColor: "#FFF", borderRadius: 17, padding: 15, borderWidth: 1, borderColor: "#EEE5E7", marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.035, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    reviewTopoNovo: { flexDirection: "row", alignItems: "center", gap: 10 },
    reviewAvatarNovo: { width: 43, height: 43, borderRadius: 22, backgroundColor: "#FFF0F2", borderWidth: 1, borderColor: "#F3CCD2", justifyContent: "center", alignItems: "center" },
    reviewNomeNovo: { color: "#1C2433", fontSize: 13, fontWeight: "800" },
    reviewDataNovo: { color: "#778195", fontSize: 11, marginTop: 3 },
    reviewNotaNovo: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "#FFF7E8", borderRadius: 9 },
    reviewNotaTextoNovo: { color: "#956013", fontSize: 12, fontWeight: "800" },
    reviewEstrelasNovo: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 8 },
    reviewTituloNovo: { fontSize: 15, color: "#1C2433", fontWeight: "800", marginTop: 10 },
    reviewComentarioNovo: { fontSize: 13, color: "#596579", marginTop: 5, lineHeight: 20 },
    secaoArquivadosNova: { backgroundColor: "#FFF", borderRadius: 20, padding: 15, marginBottom: 24, borderWidth: 1, borderColor: "#F0E7E8" },
    cabecalhoArquivadosNovo: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
    atualizarArquivadosNovo: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#FFF0F2", alignItems: "center", justifyContent: "center" },
    vazioArquivadosNovo: { paddingVertical: 35, paddingHorizontal: 12, alignItems: "center", gap: 10 },
    vazioTituloNovo: { fontSize: 16, fontWeight: "800", color: "#1C2433", textAlign: "center" },
    vazioTextoNovo: { fontSize: 13, color: "#778195", textAlign: "center" },
    arquivadoCardNovo: { borderWidth: 1, borderColor: "#F0E7E8", borderRadius: 16, padding: 10, marginBottom: 14 },
    arquivadoEtiquetaNovo: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: "#FFF0F2", paddingVertical: 6, paddingHorizontal: 9, borderRadius: 10, marginBottom: 10 },
    arquivadoEtiquetaTextoNovo: { fontSize: 11, fontWeight: "800", color: "#B01013" },
    restaurarBotaoNovo: { backgroundColor: "#B01013", minHeight: 43, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 2 },

    editarWeb: { backgroundColor: "#B01013", paddingHorizontal: 17, paddingVertical: 10, borderRadius: 24, flexDirection: "row", gap: 7, alignItems: "center", alignSelf: "flex-start", marginTop: 10 },
    editarTextoWeb: { color: "#FFF", fontSize: 13, fontWeight: "800" },
    abaWeb: { flex: 1, minHeight: 45, borderRadius: 12, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 4, marginHorizontal: 3 },
    abaAtivaWeb: { backgroundColor: "#B01013", shadowColor: "#B01013", shadowOpacity: 0.16, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
    rotuloAbaWeb: { fontSize: 10, color: "#667C9A", fontWeight: "700", textAlign: "center" },
    localWeb: { backgroundColor: "#FFF", marginHorizontal: 16, marginTop: 14, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "#F1E4E6" },
    mapaIlustrativo: { height: 115, backgroundColor: "#E9EFF5", alignItems: "center", justifyContent: "center", borderRadius: 12, marginBottom: 14 },
    localEtiqueta: { color: "#B01013", fontSize: 12, fontWeight: "800", marginBottom: 12 },
    enderecoTitulo: { fontSize: 19, fontWeight: "800", color: "#1C2433" },
    enderecoDetalhe: { fontSize: 12, color: "#697386", marginTop: 4 },
    botaoPrimarioWeb: { backgroundColor: "#B01013", borderRadius: 13, minHeight: 45, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14 },
    botaoPrimarioTextoWeb: { color: "#FFF", fontWeight: "800", fontSize: 13 },
    botaoSecundarioWeb: { borderWidth: 1, borderColor: "#F2B9C0", borderRadius: 13, minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 9 },
    botaoSecundarioTextoWeb: { color: "#B01013", fontSize: 12, fontWeight: "700" },
    subtituloWeb: { fontSize: 12, color: "#697386", marginBottom: 12 },
    secaoWeb: { backgroundColor: "#FFF", borderRadius: 18, padding: 16, marginBottom: 18 },
    topoWeb: { backgroundColor: "#FFF", paddingHorizontal: 18, paddingTop: 14, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: "#E4E8EE" },
    topoFerramentas: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 },
    identidadeWeb: { flexDirection: "row", alignItems: "center", gap: 16 },
    avatarWeb: { width: 92, height: 92, borderRadius: 46, backgroundColor: "#F6E7E9", borderWidth: 3, borderColor: "#A2B9D5", alignItems: "center", justifyContent: "center" },
    nomeWeb: { color: "#1C2433", fontSize: 26, fontWeight: "800" },
    categoriaWeb: { color: "#B01013", fontSize: 13, fontWeight: "700", marginTop: 5, backgroundColor: "#FCE9EC", alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
    favoritoWeb: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, alignSelf: "flex-start", borderWidth: 1, borderColor: "#A2B9D5", borderRadius: 20, paddingVertical: 7, paddingHorizontal: 13 },
    favoritoWebTexto: { color: "#A50910", fontSize: 13, fontWeight: "700" },
    contatosWeb: { gap: 9, marginTop: 20 },
    contatoWeb: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, backgroundColor: "#F7F9FC", borderWidth: 1, borderColor: "#DCE6F0" },
    contatoRotulo: { fontSize: 11, color: "#6B7280" },
    contatoValor: { fontSize: 14, fontWeight: "600", color: "#26303C" },
    criarAvaliacao: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", alignSelf: "center", backgroundColor: "#B01013", paddingHorizontal: 22, paddingVertical: 13, borderRadius: 12, marginVertical: 15, minWidth: 180 },
    criarAvaliacaoTexto: { color: "#FFF", fontWeight: "700" },
    modalOverlayWeb: { flex: 1, backgroundColor: "#0009" },
    modalAvaliacaoWeb: { backgroundColor: "#FFF", borderRadius: 18, borderWidth: 2, borderColor: "#A2B9D5", padding: 20 },
    modalCabecalhoWeb: { flexDirection: "row", alignItems: "flex-start", marginBottom: 20 },
    modalTituloWeb: { fontSize: 21, fontWeight: "800", color: "#B01013" },
    modalSubtituloWeb: { color: "#667085", fontSize: 13, marginTop: 4 },
    campoRotuloWeb: { color: "#26303C", fontSize: 14, fontWeight: "700", marginBottom: 8 },
    estrelasInputWeb: { flexDirection: "row", gap: 12, marginBottom: 20 },
    campoInputWeb: { borderWidth: 1, borderColor: "#A2B9D5", borderRadius: 10, padding: 12, fontSize: 14, color: "#26303C" },
    contadorWeb: { alignSelf: "flex-end", fontSize: 11, color: "#7A8391", marginTop: 4, marginBottom: 15 },
    anonimoWeb: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 15 },
    anonimoTextoWeb: { color: "#26303C", fontSize: 14 },
    erroWeb: { color: "#B01013", fontSize: 13, marginBottom: 12 },
    rodapeModalWeb: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
    cancelarWeb: { borderWidth: 1, borderColor: "#A2B9D5", padding: 12, borderRadius: 10, justifyContent: "center" },
    cancelarTextoWeb: { color: "#B01013", fontWeight: "700" },
    enviarWeb: { backgroundColor: "#B01013", padding: 12, borderRadius: 10, justifyContent: "center", alignItems: "center", minWidth: 145 },
    enviarTextoWeb: { color: "#FFF", fontWeight: "700" },
    container: {
        flex: 1,
        backgroundColor: "#F7F8FA",
    },
    fundoModal: { flex: 1, backgroundColor: "#0007", justifyContent: "center", padding: 24 },
    cartaoModal: { backgroundColor: "#FFF", borderRadius: 20, padding: 22 },
    tituloModal: { color: "#26303C", fontSize: 20, fontWeight: "700", marginBottom: 14 },
    itemModal: { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 12 },
    itemModalTexto: { color: "#26303C", fontSize: 15 },
    fecharModal: { backgroundColor: "#A50910", padding: 13, borderRadius: 12, alignItems: "center", marginTop: 10 },
    fecharModalTexto: { color: "#FFF", fontWeight: "700" },

    scrollContent: {
        paddingBottom: 30,
    },
    botaoMapa: {
        marginHorizontal: 20,
        marginTop: 12,
        marginBottom: 8,
        paddingVertical: 13,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#FFFFFF",
        backgroundColor: "#FFF0F2",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
    },
    botaoMapaTexto: {
        color: "#A50910",
        fontSize: 13,
        fontWeight: "700",
        flexShrink: 1,
    },

    topo: {
        minHeight: 260,
        backgroundColor: "#FFFFFF",
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        borderBottomWidth: 1,
        borderColor: "#EADFE1",
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
        flexWrap: "wrap",
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
        color: "#26303C",
        marginBottom: 3,
    },

    categoria: {
        fontSize: 16,
        color: "#26303C",
        marginBottom: 9,
    },

    infoLinha: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 6,
    },

    infoTexto: {
        fontSize: 13,
        color: "#26303C",
        marginLeft: 6,
    },

    acoes: {
        width: "100%",
        marginTop: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
    },

    favoritar: {
        backgroundColor: "#F7F8FA",
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
        color: "#26303C",
        fontWeight: "500",
    },

    compartilhar: {
        flexDirection: "row",
        alignItems: "center",
        marginLeft: 10,
        padding: 4,
    },

    textoCompartilhar: {
        fontSize: 12,
        marginLeft: 5,
        color: "#26303C",
    },

    areaMenu: {
        paddingHorizontal: 16,
        paddingBottom: 18,
    },

    menuNavegacao: {
        minHeight: 69,
        backgroundColor: "#FFF",
        borderRadius: 17,
        paddingHorizontal: 7,
        paddingVertical: 8,
        marginTop: 16,
        marginBottom: 19,
        borderWidth: 1,
        borderColor: "#F1E7E9",
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
        backgroundColor: "#FFF0F2",
    },

    linha: {
        height: 1,
        backgroundColor: "#E4E6EA",
        marginHorizontal: 12,
        marginBottom: 20,
    },

    estatisticas: { flexDirection: "column", gap: 12, marginBottom: 25 },
    estatistica: { width: "100%", minHeight: 84, flexDirection: "row", alignItems: "center", gap: 15, paddingHorizontal: 19, paddingVertical: 14, borderRadius: 17, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#F0E1E3", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
    estatisticaIconeNovo: { width: 37, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#FDECEF" },
    estatisticaConteudoNovo: { flex: 1, minWidth: 0 },
    divisor: { display: "none" },
    numero: { fontSize: 24, fontWeight: "800", color: "#1C2433", letterSpacing: -0.7 },
    label: { fontSize: 10, color: "#697386", marginTop: 2, lineHeight: 13 },
    postsSecaoNova: { backgroundColor: "#FFF", borderRadius: 20, padding: 15, borderWidth: 1, borderColor: "#F0E1E3", marginBottom: 24 },
    postsCabecalhoNovo: { flexDirection: "row", alignItems: "center", marginBottom: 17, gap: 12 },
    postsTituloNovo: { fontSize: 19, fontWeight: "800", color: "#1C2433" },
    postsLegendaNova: { fontSize: 12, color: "#697386", marginTop: 4 },
    postsBuscaNova: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FAF8F9", borderWidth: 1, borderColor: "#EADFE1", borderRadius: 14, paddingHorizontal: 13, marginBottom: 18, minHeight: 48 },
    postsBuscaInputNova: { flex: 1, color: "#1C2433", fontSize: 13, paddingVertical: 10 },
    postsVazioNovo: { alignItems: "center", padding: 28, gap: 8 },
    postsItemNovo: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#F0E1E3", borderRadius: 18, padding: 12, marginBottom: 16 },
    postsItemTopoNovo: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 },
    postsItemIconeNovo: { width: 35, height: 35, borderRadius: 18, backgroundColor: "#FDECEF", alignItems: "center", justifyContent: "center" },
    postsAutorNovo: { color: "#1C2433", fontSize: 13, fontWeight: "800" },
    postsMaisNovo: { padding: 8 },
    postsMenuNovo: { alignSelf: "flex-end", backgroundColor: "#FFF", borderWidth: 1, borderColor: "#EADFE1", borderRadius: 12, padding: 4, marginBottom: 12, minWidth: 185, elevation: 3 },
    postsMenuOpcaoNova: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 10 },
    postsMenuTextoNovo: { fontSize: 13, fontWeight: "600", color: "#26303C" },
    postEdicaoOverlayNova: { flex: 1, backgroundColor: "#0008" },
    postEdicaoScrollNova: { flexGrow: 1, justifyContent: "center", padding: 18 },
    postEdicaoCartaoNovo: { backgroundColor: "#FFF", padding: 20, borderRadius: 20 },

    tituloLinha: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
    },

    titulo: {
        fontSize: 17,
        fontWeight: "600",
        color: "#26303C",
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
        color: "#26303C",
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
        color: "#26303C",
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
        color: "#26303C",
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
        color: "#26303C",
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
        backgroundColor: "#FFFFFF",
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
        color: "#26303C",
        marginRight: 8,
    },

    conteudoAba: {
        alignItems: "center",
        paddingVertical: 50,
    },

    tituloAba: {
        fontSize: 22,
        fontWeight: "600",
        color: "#26303C",
        marginBottom: 10,
    },

    textoAba: {
        fontSize: 15,
        color: "#555",
        textAlign: "center",
    },

    infoOrganizacao: {
        marginTop: 25,
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 20,
        width: "100%",
    },

    infoOrganizacaoTexto: {
        fontSize: 15,
        color: "#26303C",
        marginBottom: 8,
    },

    mediaContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginLeft: 10,
    },

    mediaTexto: {
        fontSize: 14,
        fontWeight: "600",
        color: "#26303C",
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
