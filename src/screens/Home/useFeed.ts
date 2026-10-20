import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api, { apiError } from "../../api/api";
import { enrichPosts, rows, userType } from "./model";
import type { Category, FavoriteMap, Person, Post } from "./model";
export function useFeed(onUnauthorized: () => void) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [organizations, setOrganizations] = useState<Person[]>([]);
  const [person, setPerson] = useState<Person | null>(null);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [favorites, setFavorites] = useState<FavoriteMap>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [favoritesError, setFavoritesError] = useState(false);
  const [favoriteErrors, setFavoriteErrors] = useState<Record<number, string>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const generation = useRef(0);
  const locks = useRef(new Set<string>());
  const touchedCounts = useRef(new Set<number>());
  const load = useCallback(
    async (refresh = false) => {
      const run = ++generation.current;
      touchedCounts.current.clear();
      refresh ? setRefreshing(true) : setLoading(true);
      setError("");
      try {
        const meResponse = await api.get("/auth/me");
        const user: Person = meResponse.data.user;
        const id = Number(user.id_pessoa ?? user.id_pessoa_login);
        if (!id) throw new Error("Não foi possível identificar sua conta.");
        const [postResponse, likedResponse] = await Promise.all([
          api.get("/posts"),
          api.get("/likes/meus"),
        ]);
        const optional = await Promise.allSettled([
          api.get("/categorias"),
          api.get("/pessoas?tipo=ORGANIZACAO"),
          api.get(`/pessoas?id=${id}`),
          userType(user) === "CLIENTE"
            ? api.get("/Favoritos")
            : Promise.resolve({ data: { resultadoSelecionaTodos: [] } }),
          api.get("/pessoas?tipo=CLIENTE"),
        ]);
        if (run !== generation.current) return;
        const cats =
          optional[0].status === "fulfilled"
            ? rows<Category>(optional[0].value.data, ["categorias", "data"])
            : [];
        const orgs =
          optional[1].status === "fulfilled"
            ? rows<Person>(optional[1].value.data, [
                "funcionarios",
                "pessoas",
                "data",
              ])
            : [];
        const details =
          optional[2].status === "fulfilled"
            ? (rows<Person>(optional[2].value.data, [
                "pessoaId",
                "pessoas",
                "data",
              ])[0] ?? optional[2].value.data.pessoa)
            : null;
        const client =
          optional[4].status === "fulfilled"
            ? rows<Person>(optional[4].value.data, [
                "clientes",
                "pessoas",
                "data",
              ]).find((item) => Number(item.id_pessoa) === id)
            : null;
        const currentPerson = {
          ...user,
          ...details,
          id_cliente: client?.id_cliente ?? details?.id_cliente,
          id_pessoa: details?.id_pessoa ?? id,
        };
        const hydrated = enrichPosts(
          rows<Post>(postResponse.data, ["posts", "data"]),
          orgs,
          cats,
        );
        setPerson(currentPerson);
        setCategories(cats);
      setOrganizations(orgs);
        setPosts(hydrated);
        setLikedIds(
          new Set(
            rows<{ id_post: number }>(likedResponse.data, ["likes"]).map(
              (item) => Number(item.id_post),
            ),
          ),
        );
        let saved: FavoriteMap = {};
        if (optional[3].status === "fulfilled") {
          saved = {};
          for (const item of rows<{
            id_cliente?: number;
            id_organizacao?: number;
            id_favorito: number;
          }>(optional[3].value.data, [
            "resultadoSelecionaTodos",
            "favoritos",
          ])) {
            if (
              item.id_organizacao && item.id_favorito && Number(item.id_cliente) === Number(currentPerson?.id_cliente)
            )
              saved[item.id_organizacao] = {
                favoritado: true,
                id_favorito: item.id_favorito,
              };
          }
        }
        setFavorites(saved);
        setFavoritesError(optional[3].status === "rejected");
        if (optional[3].status === "rejected") setNotice("Não foi possível carregar suas empresas favoritas. Puxe o feed para tentar novamente.");
        else if (optional.some((item) => item.status === "rejected"))
          setNotice(
            "Algumas informações não carregaram. Puxe o feed para tentar novamente.",
          );
        setLoading(false);
        setRefreshing(false);
        let cursor = 0;
        const totals: Record<number, number> = {};
        await Promise.all(
          Array.from({ length: Math.min(hydrated.length, 4) }, async () => {
            while (cursor < hydrated.length) {
              const post = hydrated[cursor++];
              try {
                const result = await api.get(
                  `/likes/contar?id_post=${post.id_post}`,
                );
                totals[post.id_post] = Number(result.data.total ?? 0);
              } catch {
                /* do not display invented counts */
              }
            }
          }),
        );
        if (run === generation.current)
          setCounts((previous) => ({
            ...totals,
            ...Object.fromEntries(
              Object.entries(previous).filter(([key]) =>
                touchedCounts.current.has(Number(key)),
              ),
            ),
          }));
      } catch (cause: any) {
        if (run !== generation.current) return;
        if (cause.response?.status === 401) onUnauthorized();
        else setError(apiError(cause));
      } finally {
        if (run === generation.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [onUnauthorized],
  );
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        generation.current++;
      };
    }, [load]),
  );
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const lock = (key: string) => {
    if (locks.current.has(key)) return false;
    locks.current.add(key);
    setPending(new Set(locks.current));
    return true;
  };
  const unlock = (key: string) => {
    locks.current.delete(key);
    setPending(new Set(locks.current));
  };
  const toggleLike = async (postId: number) => {
    const key = `like:${postId}`;
    if (!lock(key)) return;
    const liked = likedIds.has(postId);
    const old = counts[postId];
    touchedCounts.current.add(postId);
    setLikedIds((previous) => {
      const next = new Set(previous);
      liked ? next.delete(postId) : next.add(postId);
      return next;
    });
    if (old !== undefined)
      setCounts((previous) => ({
        ...previous,
        [postId]: Math.max(0, old + (liked ? -1 : 1)),
      }));
    try {
      const result = await api.post("/likes/toggle", { id_post: postId });
      setLikedIds((previous) => {
        const next = new Set(previous);
        result.data.curtiu ? next.add(postId) : next.delete(postId);
        return next;
      });
      setCounts((previous) => ({
        ...previous,
        [postId]: Number(result.data.totalLikes),
      }));
    } catch (cause) {
      setLikedIds((previous) => {
        const next = new Set(previous);
        liked ? next.add(postId) : next.delete(postId);
        return next;
      });
      if (old !== undefined)
        setCounts((previous) => ({ ...previous, [postId]: old }));
      setNotice(apiError(cause));
    } finally {
      unlock(key);
    }
  };
  const toggleFavorite = async (orgId: number) => {
    const key = `favorite:${orgId}`;
    if (!lock(key)) return;
    setFavoriteErrors(previous => ({ ...previous, [orgId]: "" }));
    try {
      if (!Number(person?.id_cliente)) throw new Error("Não foi possível identificar o cadastro de cliente. Entre novamente na conta.");
      const existing = favorites[orgId];
      let entry;
      if (existing?.favoritado && existing.id_favorito) {
        await api.delete(`/Favoritos/${existing.id_favorito}`);
        entry = { favoritado: false };
      } else {
        const result = await api.post("/Favoritos", {
          id_organizacao: orgId,
            id_cliente: Number(person?.id_cliente),
        });
        const id = Number(
          result.data.novoRegistro?.insertId ?? result.data.id_favorito,
        );
        if (!id)
          throw new Error(
            "O servidor não retornou o identificador do favorito.",
          );
        entry = { favoritado: true, id_favorito: id };
      }
      const value = entry;
      setFavorites((previous) => {
        const next = { ...previous, [orgId]: value };
        void AsyncStorage.setItem(
          `tadaki:favorites:${person?.id_pessoa}`,
          JSON.stringify(next),
        );
        return next;
      });
    } catch (cause) {
      const message = apiError(cause);
      setNotice(message);
      setFavoriteErrors(previous => ({ ...previous, [orgId]: message }));
    } finally {
      unlock(key);
    }
  };
  return {
    posts,
    person,
    categories,
    organizations,
    likedIds,
    counts,
    favorites,
    favoritesError,
    favoriteErrors,
    loading,
    refreshing,
    error,
    notice,
    pending,
    setNotice,
    load,
    toggleLike,
    toggleFavorite,
  };
}
