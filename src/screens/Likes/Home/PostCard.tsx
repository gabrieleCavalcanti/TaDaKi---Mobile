import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { imageUrl } from "../../api/api";
import { colors, styles as s } from "./styles";
import { Reveal } from "./motion";
import type { Post } from "./model";
export default function PostCard({
  post,
  liked,
  count,
  favorite,
  canFavorite,
  pendingLike,
  pendingFavorite,
  reduced,
  onLike,
  onFavorite,
  onProfile,
  onImage,
}: {
  post: Post;
  liked: boolean;
  count?: number;
  favorite: boolean;
  canFavorite: boolean;
  pendingLike: boolean;
  pendingFavorite: boolean;
  reduced: boolean;
  onLike: () => void;
  onFavorite: () => void;
  onProfile: () => void;
  onImage: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const heartScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!liked || reduced) {
      heartScale.setValue(1);
      return;
    }
    const animation = Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 1.15,
        duration: 110,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(heartScale, {
        toValue: 1,
        duration: 130,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [liked, reduced, heartScale]);
  return (
    <Reveal reduced={reduced}>
      <View style={s.card}>
        <View style={s.cardHeader}>
          <TouchableOpacity
            style={s.orgButton}
            disabled={!post.id_pessoa_organizacao}
            onPress={onProfile}
            accessibilityRole="button"
            accessibilityLabel={`Abrir perfil de ${post.nome_organizacao}`}
          >
            <View style={s.avatar}>
              {post.foto_organizacao && !avatarFailed ? (
                <Image
                  source={{ uri: imageUrl(post.foto_organizacao) }}
                  style={s.avatarImage}
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <Text style={s.avatarText}>
                  {post.nome_organizacao?.charAt(0) || "T"}
                </Text>
              )}
            </View>
            <Text style={[s.orgName, { flex: 1 }]} numberOfLines={1}>
              {post.nome_organizacao}
            </Text>
          </TouchableOpacity>
          <View style={s.category}>
            <Text style={s.categoryText} numberOfLines={1}>
              {post.descricao_categoria}
            </Text>
          </View>
        </View>
        <View style={s.favoriteRow}>
            {canFavorite && (
              <TouchableOpacity
                style={[s.social, s.favoriteAction]}
                onPress={onFavorite}
                disabled={pendingFavorite}
                accessibilityRole="button"
                accessibilityState={{
                  selected: favorite,
                  disabled: pendingFavorite,
                }}
                accessibilityLabel={favorite ? "Remover organização dos favoritos" : "Favoritar organização"}
              >
                <Ionicons
                  name={favorite ? "star" : "star-outline"}
                  size={22}
                  color={favorite ? "#557B5D" : colors.ink}
                />
                <Text style={s.socialText}>
                  {favorite ? "Favoritada" : "Favoritar organização"}
                </Text>
              </TouchableOpacity>
            )}
        </View>
        <TouchableOpacity
          style={s.media}
          onPress={onImage}
          disabled={!post.vincularImagem || failed}
          activeOpacity={0.92}
          accessibilityRole="button"
          accessibilityLabel={`Ampliar foto de ${post.titulo}`}
        >
          {post.vincularImagem && !failed ? (
            <Image
              source={{ uri: imageUrl(post.vincularImagem) }}
              style={s.mediaImage}
              resizeMode="contain"
              onError={() => setFailed(true)}
            />
          ) : (
            <>
              <Ionicons name="image-outline" size={35} color={colors.muted} />
              <Text style={s.helper}>Imagem indisponível</Text>
            </>
          )}
        </TouchableOpacity>
        <View style={s.footer}>
          <View style={s.socialRow}>
            <TouchableOpacity
              style={s.social}
              onPress={onLike}
              disabled={pendingLike}
              accessibilityRole="button"
              accessibilityState={{ selected: liked, disabled: pendingLike }}
              accessibilityLabel={
                liked
                  ? `Remover curtida de ${post.titulo}`
                  : `Curtir ${post.titulo}`
              }
            >
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Ionicons
                  name={liked ? "heart" : "heart-outline"}
                  size={24}
                  color={liked ? colors.brand : colors.ink}
                />
              </Animated.View>
              <Text style={[s.socialText, liked && { color: colors.brand }]}>
                {count === undefined
                  ? liked
                    ? "Curtido"
                    : "Curtir"
                  : `${count} ${count === 1 ? "curtida" : "curtidas"}`}
              </Text>
            </TouchableOpacity>

          </View>
          <Text style={s.postTitle}>{post.titulo}</Text>
          {post.descricao && (
            <>
              <Text
                style={s.description}
                numberOfLines={
                  expanded || post.descricao.length <= 160 ? undefined : 3
                }
              >
                {post.descricao}
              </Text>
              {post.descricao.length > 160 && (
                <TouchableOpacity onPress={() => setExpanded(!expanded)}>
                  <Text style={s.textButton}>
                    {expanded ? "Mostrar menos" : "Ver descrição completa"}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
          <TouchableOpacity
            style={s.businessLink}
            disabled={!post.id_pessoa_organizacao}
            onPress={onProfile}
          >
            <Text style={s.businessLinkText}>Conhecer a empresa</Text>
            <Ionicons name="arrow-up-outline" size={15} color="#526C84" />
          </TouchableOpacity>
        </View>
      </View>
    </Reveal>
  );
}
