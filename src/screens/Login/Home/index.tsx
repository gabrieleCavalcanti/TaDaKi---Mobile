import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { ViewToken } from "react-native";
import type { RootStackParamList } from "../../../App";
import api, { imageUrl } from "../../api/api";
import { removerTokens } from "../../storage/authStorage";
import { filterPosts, userType } from "./model";
import type { Post } from "./model";
import { useFeed } from "./useFeed";
import { useDiscovery } from "./useDiscovery";
import { RegionPicker } from "./RegionPicker";
import { proximity, proximityLabels } from "./recommendations";
import { MenuReveal, useReducedMotion } from "./motion";
import { colors, styles as s } from "./styles";
import PostCard from "./PostCard";
import CreatePostModal from "../../components/CreatePostModal";
import LoadingScreen from "../../components/LoadingScreen";
export function FeedScreen({
  navigation,
  onlyLikes = false,
  initialFavorites = false,
}: {
  navigation: Pick<
    NativeStackNavigationProp<RootStackParamList>,
    "navigate" | "reset" | "popTo"
  >;
  onlyLikes?: boolean;
  initialFavorites?: boolean;
}) {
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const unauthorized = useCallback(() => {
    void removerTokens().then(() =>
      navigation.reset({ index: 0, routes: [{ name: "Login" }] }),
    );
  }, [navigation]);
  // Busca os posts e as informações da conta.
  const feed = useFeed(unauthorized);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(0);
  const [favoritesOnly, setFavoritesOnly] = useState(initialFavorites);
  const [menu, setMenu] = useState(false);
  const [composer, setComposer] = useState(false);
  const [image, setImage] = useState<Post | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [explore, setExplore] = useState(false);
  const [visiblePosts, setVisiblePosts] = useState<Set<number>>(new Set());
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 5 }).current;
  // Anima os posts que chegam à tela.
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<Post>[] }) => {
    setVisiblePosts(new Set(viewableItems.map(entry => entry.item.id_post)));
  }).current;
  const discovery = useDiscovery(
    Number(feed.person?.id_pessoa ?? feed.person?.id_pessoa_login ?? 0),
    feed.posts,
    feed.likedIds,
    feed.favorites,
    !explore && !onlyLikes && !favoritesOnly && !search.trim() && !category,
  );
  useEffect(() => {
    setFavoritesOnly(initialFavorites);
  }, [initialFavorites]);
  useEffect(() => {
    if (!focused) {
      setMenu(false);
      setComposer(false);
      setImage(null);
    }
  }, [focused]);
  const type = userType(feed.person);
  const canCreate = type === "ORGANIZACAO";
  const canFavorite = type === "CLIENTE";
  const data = useMemo(
    () =>
      filterPosts(
        onlyLikes
          ? feed.posts.filter((post) => feed.likedIds.has(post.id_post))
          : favoritesOnly
            ? feed.posts
            : discovery.posts,
        search,
        category,
        favoritesOnly,
        feed.favorites,
      ),
    [
      onlyLikes,
      feed.posts,
      discovery.posts,
      feed.likedIds,
      search,
      category,
      favoritesOnly,
      feed.favorites,
    ],
  );
  const onPublished = useCallback(async () => {
    setExplore(true);
    await feed.load();
  }, [feed.load]);
  const Header = (
    <View>
      {onlyLikes && (
        <TouchableOpacity onPress={() => navigation.popTo("Home")} style={{ padding: 16 }}>
          <Text style={s.textButton}>← Voltar para o feed</Text>
        </TouchableOpacity>
      )}
      <View style={s.heading}>
        <Text style={s.eyebrow}>
          {onlyLikes ? "CURTIDOS" : "VITRINE LOCAL"}
        </Text>
        <Text style={s.title}>
          {onlyLikes
            ? "Suas descobertas favoritas"
            : favoritesOnly
              ? "Empresas favoritas"
              : "Descubra quem faz acontecer"}
        </Text>
        <Text style={s.subtitle}>
          {onlyLikes
            ? "Reencontre os produtos e serviços que chamaram sua atenção."
            : "Produtos, serviços e histórias dos pequenos negócios."}
        </Text>
      </View>
      {!onlyLikes && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <View style={[s.row, { marginBottom: 8 }]}>
            <TouchableOpacity
              style={[s.chip, !explore && !favoritesOnly && s.chipActive]}
              accessibilityState={{ selected: !explore && !favoritesOnly }}
              onPress={() => {
                setExplore(false);
                setFavoritesOnly(false);
              }}
            >
              <Text style={[ s.chipText, !explore && !favoritesOnly && s.chipActiveText, ]}>
                Para você
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.chip, explore && !favoritesOnly && s.chipActive]}
              accessibilityState={{ selected: explore && !favoritesOnly }}
              onPress={() => {
                setExplore(true);
                setFavoritesOnly(false);
              }}
            >
              <Text style={[ s.chipText, explore && !favoritesOnly && s.chipActiveText, ]}>
                Explorar
              </Text>
            </TouchableOpacity>
            {canFavorite && (
              <TouchableOpacity style={[s.chip, favoritesOnly && s.chipActive]} accessibilityState={{ selected: favoritesOnly }} onPress={() => setFavoritesOnly(true)}>
                <Text style={[s.chipText, favoritesOnly && s.chipActiveText]}>
                  Favoritas
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {favoritesOnly ? (
            <Text style={s.helper}>
              Timeline somente das empresas que você favoritou, das publicações
              mais recentes para as mais antigas.
            </Text>
          ) : (
            <>
              <Text style={s.helper}>
                {discovery.locating
                  ? "Ordenando por proximidade…"
                  : !discovery.locations.user.length
                    ? "Defina sua região para descobrir negócios por proximidade."
                    : discovery.selectedAddress
                      ? `Região escolhida: ${discovery.selectedAddress.municipio} / ${discovery.selectedAddress.uf}.`
                      : "Perto do seu endereço cadastrado: rua, bairro, cidade e estado."}
              </Text>
              <RegionPicker initial={discovery.locations.user[0]} save={discovery.saveReference} />
              {!explore && !favoritesOnly && !discovery.hasInterests && (
                <Text style={s.helper}>
                  Curta produtos, amplie fotos ou visite empresas para
                  personalizar sua vitrine.
                </Text>
              )}
            </>
          )}
        </View>
      )}
      <View style={s.search}>
        <Ionicons name="search" size={19} color={colors.muted} />
        <TextInput style={s.input} value={search} onChangeText={setSearch} placeholder="Buscar produto, empresa ou categoria" accessibilityLabel="Buscar publicações" />
        {search && (
          <TouchableOpacity onPress={() => setSearch("")} accessibilityLabel="Limpar busca" style={{ padding: 5 }}>
            <Ionicons name="close" size={20} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
        <TouchableOpacity style={[s.chip, !category && s.chipActive]} onPress={() => setCategory(0)}>
          <Text style={[s.chipText, !category && s.chipActiveText]}>Todas</Text>
        </TouchableOpacity>
        {feed.categories.map((item) => (
          <TouchableOpacity key={item.id_categoria} style={[ s.chip, category === Number(item.id_categoria) && s.chipActive, ]} onPress={() => setCategory(Number(item.id_categoria))}>
            <Text style={[ s.chipText, category === Number(item.id_categoria) && s.chipActiveText, ]}>
              {item.descricao}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {feed.notice && (
        <View style={s.notice}>
          <Text style={s.noticeText}>{feed.notice}</Text>
          <TouchableOpacity onPress={() => feed.setNotice("")} accessibilityLabel="Fechar aviso" style={{ padding: 7 }}>
            <Ionicons name="close" size={20} color={colors.ink} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
  const timelineError = favoritesOnly && feed.favoritesError ? "Não foi possível carregar sua timeline. Puxe o feed para tentar novamente." : "";
  const Empty = feed.loading ? (
    <View accessibilityLabel="Carregando publicações" style={s.skeletonCard}>
      <View style={[s.skeleton, { height: 42, width: "65%" }]} />
      <View style={[s.skeleton, { width: "100%", aspectRatio: 4 / 3 }]} />
      <ActivityIndicator color={colors.brand} />
    </View>
  ) : (
    <View style={s.state}>
      <Ionicons name={(feed.error || timelineError) ? "cloud-offline-outline" : "heart-outline"} size={44} color={colors.brand} />
      <Text style={s.stateTitle}>
        {(feed.error || timelineError)
          ? "Não foi possível carregar"
          : search || category
            ? "Nenhuma publicação encontrada"
            : onlyLikes
              ? "Suas próximas descobertas ficam aqui"
              : favoritesOnly
                ? "Sua timeline começa com uma empresa favorita"
                : "A vitrine está esperando novidades"}
      </Text>
      <Text style={s.stateCopy}>
        {feed.error || timelineError ||
          (onlyLikes
            ? "Curta uma publicação no feed e reencontre o produto aqui."
            : favoritesOnly
              ? "Favorite uma empresa na aba Explorar para acompanhar as publicações dela aqui."
              : "Experimente outra categoria ou volte para todas as publicações.")}
      </Text>
      <TouchableOpacity
        style={s.primary}
        onPress={() => {
          if (feed.error || timelineError) void feed.load();
          else if (onlyLikes) navigation.popTo("Home");
          else {
            setSearch("");
            setCategory(0);
            setFavoritesOnly(false);
            setExplore(true);
          }
        }}
      >
        <Text style={s.primaryText}>
          {(feed.error || timelineError)
            ? "Tentar novamente"
            : onlyLikes
              ? "Explorar publicações"
              : "Ver todas"}
        </Text>
      </TouchableOpacity>
    </View>
  );
  if (feed.loading) return <LoadingScreen reduced={reduced} />;
  return (
    <SafeAreaView style={s.page} edges={["top", "bottom"]}>
      <View style={s.header}>
        <TouchableOpacity accessibilityLabel="Página inicial" onPress={() => navigation.popTo("Home")}>
          <Image source={require("../../assets/logoTaDaKi.webp")} style={s.logo} resizeMode="contain" />
        </TouchableOpacity>
        <View style={s.row}>
          {canCreate && !onlyLikes && (
            <TouchableOpacity style={[s.iconButton, s.createButton]} onPress={() => setComposer(true)} accessibilityLabel="Criar publicação">
              <Ionicons name="add" size={25} color="white" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.iconButton} onPress={() => setMenu(true)} accessibilityLabel="Abrir menu">
            <Ionicons name="menu" size={24} color={colors.ink} />
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={feed.loading ? [] : data}
        keyExtractor={(post) => String(post.id_post)}
        ListHeaderComponent={Header}
        ListEmptyComponent={Empty}
        ListFooterComponent={
          <Text style={[s.helper, { textAlign: "center", padding: 24 }]}>
            Feito para aproximar pessoas e microempresas.
          </Text>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshing={feed.refreshing}
        onRefresh={() => void feed.load(true)}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={7}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        renderItem={({ item }) => (
          <View>
            {!onlyLikes &&
              !favoritesOnly &&
              !discovery.locating &&
              discovery.locations.user.length > 0 && (
                <Text style={[ s.helper, { paddingHorizontal: 16, paddingVertical: 8 }, ]}>
                  {
                    proximityLabels[
                      proximity(
                        discovery.locations.user,
                        discovery.locations.organizations[
                          item.id_organizacao
                        ] ?? [],
                      )
                    ]
                  }
                </Text>
              )}
            <PostCard
              post={item}
              liked={feed.likedIds.has(item.id_post)}
              count={feed.counts[item.id_post]}
              favorite={Boolean(
                feed.favorites[item.id_organizacao]?.favoritado,
              )}
              canFavorite={canFavorite}
              favoriteError={feed.favoriteErrors[item.id_organizacao]}
              pendingLike={feed.pending.has(`like:${item.id_post}`)}
              pendingFavorite={feed.pending.has(
                `favorite:${item.id_organizacao}`,
              )}
              reduced={reduced}
              visible={visiblePosts.has(item.id_post)}
              onLike={() => void feed.toggleLike(item.id_post)}
              onFavorite={() => void feed.toggleFavorite(item.id_organizacao)}
              onProfile={() => {
                discovery.record(item, "profile");
                if (item.id_pessoa_organizacao)
                  navigation.navigate("Perfil", {
                    id_pessoa: item.id_pessoa_organizacao,
                  });
              }}
              onImage={() => {
                discovery.record(item, "image");
                setImageFailed(false);
                setImage(item);
              }}
            />
          </View>
        )}
      />
      <Modal visible={focused && menu} transparent animationType={reduced ? "none" : "fade"} onRequestClose={() => setMenu(false)}>
        <Pressable style={s.menuBackdrop} onPress={() => setMenu(false)}>
          <MenuReveal open={focused && menu} reduced={reduced}>
          <Pressable style={s.menu} onPress={(event) => event.stopPropagation()}>
            <View style={s.row}>
              <Text style={s.menuTitle}>Seu TaDaKi</Text>
              <TouchableOpacity style={s.iconButton} onPress={() => setMenu(false)} accessibilityLabel="Fechar menu">
                <Ionicons name="close" size={24} color={colors.ink} />
              </TouchableOpacity>
            </View>
            <View style={s.menuAccount}>
              <View style={s.avatar}><Text style={s.avatarText}>{(feed.person?.nome || feed.person?.username || "T").charAt(0).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}><Text style={s.orgName}>{feed.person?.nome || feed.person?.username || "Sua conta"}</Text><Text style={s.helper}>{canCreate ? "Organização" : "Cliente"}</Text></View>
            </View>
            <Text style={s.menuSection}>NAVEGAÇÃO</Text>
            <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={[s.menuItem, !onlyLikes && !favoritesOnly && s.menuItemActive]}
              accessibilityState={{ selected: !onlyLikes && !favoritesOnly }}
              onPress={() => {
                setMenu(false);
                setExplore(false);
                setFavoritesOnly(false);
                navigation.popTo("Home", { favoritos: false });
              }}
            >
              <Ionicons name="home-outline" size={20} color={colors.ink} />
              <Text style={s.menuText}>Início</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.menuItem}
              onPress={() => {
                setMenu(false);
                // Abre o perfil que já existe no aplicativo.
                const id = Number(feed.person?.id_pessoa ?? feed.person?.id_pessoa_login);
                if (Number.isSafeInteger(id) && id > 0) {
                  navigation.navigate("Perfil", { id_pessoa: id });
                } else feed.setNotice("Não foi possível identificar seu perfil. Atualize o feed.");
              }}
            >
              <Ionicons name="person-outline" size={20} color={colors.ink} />
              <Text style={s.menuText}>Meu perfil</Text>
            </TouchableOpacity>
            {canCreate && (
              <TouchableOpacity style={s.menuItem} onPress={() => { setMenu(false); navigation.navigate("Dashboard"); }}>
                <Ionicons name="stats-chart-outline" size={20} color={colors.ink} />
                <Text style={s.menuText}>Dashboard</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.menuItem, onlyLikes && s.menuItemActive]}
              accessibilityState={{ selected: onlyLikes }}
              onPress={() => {
                setMenu(false);
                navigation.navigate("Likes");
              }}
            >
              <Ionicons name="heart-outline" size={20} color={colors.ink} />
              <Text style={s.menuText}>Curtidos</Text>
            </TouchableOpacity>
            {canFavorite && (
              <TouchableOpacity
                style={[s.menuItem, favoritesOnly && !onlyLikes && s.menuItemActive]}
                accessibilityState={{ selected: favoritesOnly && !onlyLikes }}
                onPress={() => {
                  setMenu(false);
                  if (onlyLikes) navigation.popTo("Home", { favoritos: true });
                  else setFavoritesOnly(true);
                }}
              >
                <Ionicons name="star-outline" size={20} color={colors.ink} />
                <Text style={s.menuText}>
                  Favoritos
                </Text>
              </TouchableOpacity>
            )}
            <Text style={s.menuSection}>CONTA</Text>
            <TouchableOpacity style={s.menuItem} onPress={() => { setMenu(false); void api .post("/auth/logout") .catch(() => {}) .finally(unauthorized); }}>
              <Ionicons name="log-out-outline" size={20} color={colors.brand} />
              <Text style={[s.menuText, { color: colors.brand }]}>
                Sair da conta
              </Text>
            </TouchableOpacity>
            </ScrollView>
          </Pressable>
          </MenuReveal>
        </Pressable>
      </Modal>
      <Modal visible={focused && Boolean(image)} transparent animationType={reduced ? "none" : "fade"} onRequestClose={() => setImage(null)}>
        <SafeAreaView style={s.imageBackdrop}>
          <TouchableOpacity style={s.fullImageClose} onPress={() => setImage(null)} accessibilityLabel="Fechar imagem">
            <Ionicons name="close-circle" size={38} color="white" />
          </TouchableOpacity>
          {imageFailed ? (
            <Text style={s.fullImageTitle}>
              Não foi possível abrir esta imagem.
            </Text>
          ) : (
            <Image source={{ uri: imageUrl(image?.vincularImagem) }} style={s.fullImage} resizeMode="contain" onError={() => setImageFailed(true)} />
          )}
          <Text style={s.fullImageTitle}>{image?.titulo}</Text>
        </SafeAreaView>
      </Modal>
      {canCreate && !onlyLikes && (
        <CreatePostModal open={focused && composer} close={() => setComposer(false)} person={feed.person} categories={feed.categories} onPublished={onPublished} reduced={reduced} />
      )}
    </SafeAreaView>
  );
}
export default function HomeScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, "Home">) {
  return (
    <FeedScreen navigation={navigation} initialFavorites={Boolean(route.params?.favoritos)} />
  );
}
