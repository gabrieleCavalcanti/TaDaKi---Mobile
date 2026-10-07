import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api, { apiError } from "../../api/api";
import { colors, styles as s } from "./styles";
import type { Category, Person } from "./model";
export default function CreatePostModal({
  open,
  close,
  person,
  categories,
  onPublished,
  reduced,
}: {
  open: boolean;
  close: () => void;
  person: Person | null;
  categories: Category[];
  onPublished: () => Promise<void>;
  reduced: boolean;
}) {
  const [step, setStep] = useState(0);
  const [uri, setUri] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const pickerLock = useRef(false);
  const publishLock = useRef(false);
  const draftKey = `tadaki:draft:${person?.id_organizacao ?? 0}`;
  const [draftReady, setDraftReady] = useState("");
  useEffect(() => {
    let active = true;
    setDraftReady("");
    void AsyncStorage.getItem(draftKey).then((raw) => {
      if (!active) return;
      try {
        const saved = JSON.parse(raw || "{}");
        setTitle(saved.title || "");
        setDescription(saved.description || "");
        setCategory(Number(saved.category) || 0);
      } catch {
        /* ignore corrupt draft */
      }
      setDraftReady(draftKey);
    });
    return () => {
      active = false;
    };
  }, [draftKey]);
  useEffect(() => {
    if (draftReady === draftKey && step !== 2)
      void AsyncStorage.setItem(
        draftKey,
        JSON.stringify({ title, description, category }),
      );
  }, [draftKey, draftReady, step, title, description, category]);
  const chooseImage = async (crop = false, camera = false) => {
    if (pickerLock.current) return;
    pickerLock.current = true;
    setPicking(true);
    setError("");
    try {
      if (camera && Platform.OS !== "web") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setCameraBlocked(!permission.canAskAgain);
          throw new Error("Permita o acesso à câmera para tirar a foto do produto.");
        }
        setCameraBlocked(false);
      } else if (Platform.OS !== "web") {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted)
          throw new Error(
            "Permita o acesso às fotos para selecionar a imagem do produto.",
          );
      }
      const launch = camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
      const result = await launch({
        mediaTypes: ["images"],
        allowsEditing: crop,
        aspect: [1, 1],
        quality: 0.95,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024)
        throw new Error("Selecione uma imagem de até 10 MB.");
      const resize =
        asset.width > 1600 || asset.height > 1600
          ? [
              {
                resize:
                  asset.width >= asset.height
                    ? { width: 1600 }
                    : { height: 1600 },
              },
            ]
          : [];
      // Normalize HEIC and other gallery formats to the JPEG format accepted by this API.
      const prepared = await ImageManipulator.manipulateAsync(
        asset.uri,
        resize,
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );
      setUri(prepared.uri);
    } catch (cause) {
      setError(apiError(cause));
    } finally {
      setPicking(false);
      pickerLock.current = false;
    }
  };
  const publish = async () => {
    if (publishLock.current) return;
    setError("");
    if (!uri) return setError("Selecione uma foto do produto ou serviço.");
    if (!title.trim()) return setError("Dê um nome ao produto ou serviço.");
    if (!categories.some((item) => Number(item.id_categoria) === category))
      return setError("Selecione uma categoria válida.");
    if (!person?.id_organizacao)
      return setError("Atualize o feed para identificar sua organização.");
    publishLock.current = true;
    setBusy(true);
    try {
      const data = new FormData();
      data.append("titulo", title.trim());
      data.append("descricao", description.trim());
      data.append("id_categoria", String(category));
      data.append("id_organizacao", String(person.id_organizacao));
      if (Platform.OS === "web") {
        const blob = await (await fetch(uri)).blob();
        if (blob.size > 10 * 1024 * 1024)
          throw new Error("A imagem preparada excede 10 MB.");
        data.append(
          "image",
          new File([blob], "produto.jpg", { type: "image/jpeg" }),
        );
      } else
        data.append("image", {
          uri,
          name: "produto.jpg",
          type: "image/jpeg",
        } as unknown as Blob);
      await api.post(
        "/posts",
        data,
        Platform.OS === "web"
          ? {}
          : { headers: { "Content-Type": "multipart/form-data" } },
      );
      await AsyncStorage.removeItem(draftKey);
      setTitle("");
      setDescription("");
      setCategory(0);
      setUri("");
      setStep(2);
      await onPublished();
    } catch (cause) {
      setError(apiError(cause));
    } finally {
      setBusy(false);
      publishLock.current = false;
    }
  };
  return (
    <Modal
      visible={open}
      animationType={reduced ? "none" : "slide"}
      onRequestClose={() => {
        if (!busy && !picking) close();
      }}
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={[s.page, { backgroundColor: "white" }]}>
        <View style={s.composerHeader}>
          <TouchableOpacity
            disabled={busy || picking}
            onPress={() => (step === 1 ? setStep(0) : close())}
            accessibilityLabel={
              step === 1 ? "Voltar para imagem" : "Fechar criação de publicação"
            }
            style={s.iconButton}
          >
            <Ionicons
              name={step === 1 ? "arrow-back" : "close"}
              size={23}
              color={colors.ink}
            />
          </TouchableOpacity>
          <Text style={s.composerTitle}>
            {step === 2 ? "Publicado!" : "Nova publicação"}
          </Text>
          {step !== 2 ? (
            <TouchableOpacity
              style={{ padding: 12 }}
              disabled={busy || picking || (step === 0 && !uri)}
              onPress={() => (step === 0 ? setStep(1) : void publish())}
            >
              <Text
                style={[
                  s.accent,
                  (busy || picking || (step === 0 && !uri)) && s.disabled,
                ]}
              >
                {busy ? "Enviando…" : step === 0 ? "Avançar" : "Publicar"}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>
        {step === 2 ? (
          <View style={s.success}>
            <Ionicons
              name="checkmark-circle-outline"
              size={75}
              color="#557B5D"
            />
            <Text style={s.stateTitle}>Seu negócio está no feed</Text>
            <Text style={s.stateCopy}>
              Sua publicação já pode ser descoberta pela comunidade.
            </Text>
            <TouchableOpacity
              style={s.primary}
              onPress={() => {
                setStep(0);
                close();
              }}
            >
              <Text style={s.primaryText}>Voltar para o feed</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              contentContainerStyle={s.composerContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={s.stepText}>
                {step === 0
                  ? "1. Foto do produto"
                  : "2. Informações da publicação"}
              </Text>
              {uri ? (
                <>
                  <Image
                    source={{ uri }}
                    resizeMode="contain"
                    style={[s.preview, step === 1 && s.previewSmall]}
                  />
                  <View
                    style={[
                      s.row,
                      {
                        justifyContent: "center",
                        marginTop: 12,
                        flexWrap: "wrap",
                      },
                    ]}
                  >
                    <TouchableOpacity
                      disabled={busy || picking}
                      onPress={() => void chooseImage(false)}
                    >
                      <Text style={s.textButton}>Trocar foto</Text>
                    </TouchableOpacity>
                    {Platform.OS !== "web" && (
                      <TouchableOpacity
                        disabled={busy || picking}
                        onPress={() => void chooseImage(true)}
                      >
                        <Text style={s.textButton}>Selecionar com recorte</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              ) : (
                <TouchableOpacity
                  style={s.upload}
                  disabled={picking}
                  onPress={() => void chooseImage()}
                >
                  <Ionicons name="images-outline" size={60} color="#637A8E" />
                  <Text style={s.uploadTitle}>
                    A próxima descoberta começa aqui
                  </Text>
                  <Text style={s.stateCopy}>
                    Escolha uma boa foto do produto ou serviço.
                  </Text>
                  <View style={s.primary}>
                    <Text style={s.primaryText}>
                      {picking ? "Preparando foto…" : "Selecionar imagem"}
                    </Text>
                  </View>
                  <Text style={s.stateCopy}>Até 10 MB · preparada em JPEG</Text>
                </TouchableOpacity>
              )}
              <View style={[s.row, { justifyContent: "center", marginTop: 16, flexWrap: "wrap" }]}>
                <TouchableOpacity style={s.primary} disabled={busy || picking} accessibilityLabel={uri ? "Tirar outra foto" : "Tirar foto"} onPress={() => void chooseImage(false, true)}>
                  <Ionicons name="camera-outline" size={24} color="white" />
                  <Text style={s.primaryText}>{uri ? "Tirar outra foto" : "Tirar foto"}</Text>
                </TouchableOpacity>
                {cameraBlocked && Platform.OS !== "web" && <TouchableOpacity disabled={busy || picking} onPress={() => {void Linking.openSettings().catch(() => setError("Abra as configurações do aparelho e permita a câmera para o TaDaKi."));}}><Text style={s.textButton}>Abrir configurações</Text></TouchableOpacity>}
              </View>
              {picking && (
                <ActivityIndicator
                  color={colors.brand}
                  style={{ marginTop: 15 }}
                />
              )}
              {step === 1 && (
                <>
                  <View style={[s.row, { marginTop: 18 }]}>
                    <View style={s.avatar}>
                      <Text style={s.avatarText}>
                        {person?.nome?.charAt(0) || "T"}
                      </Text>
                    </View>
                    <View>
                      <Text style={s.orgName}>
                        {person?.nome || person?.username || "Sua empresa"}
                      </Text>
                      <Text style={s.helper}>Publicando como organização</Text>
                    </View>
                  </View>
                  <Text style={s.label}>Produto ou serviço</Text>
                  <TextInput
                    style={s.field}
                    value={title}
                    onChangeText={setTitle}
                    maxLength={150}
                    placeholder="Ex.: Bolo de chocolate artesanal"
                    editable={!busy}
                  />
                  <Text style={s.counter}>{title.length}/150</Text>
                  <Text style={s.label}>Descrição</Text>
                  <TextInput
                    style={[
                      s.field,
                      { minHeight: 115, textAlignVertical: "top" },
                    ]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Conte os diferenciais, opções e como saber mais."
                    multiline
                    maxLength={3000}
                    editable={!busy}
                  />
                  <Text style={s.counter}>{description.length}/3000</Text>
                  <Text style={s.label}>Categoria</Text>
                  <View style={[s.row, { flexWrap: "wrap" }]}>
                    {categories.map((item) => (
                      <TouchableOpacity
                        key={item.id_categoria}
                        disabled={busy}
                        style={[
                          s.chip,
                          category === Number(item.id_categoria) &&
                            s.chipActive,
                        ]}
                        onPress={() => setCategory(Number(item.id_categoria))}
                        accessibilityState={{
                          selected: category === Number(item.id_categoria),
                        }}
                      >
                        <Text
                          style={[
                            s.chipText,
                            category === Number(item.id_categoria) &&
                              s.chipActiveText,
                          ]}
                        >
                          {item.descricao}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {!categories.length && (
                    <Text style={s.error}>
                      As categorias não carregaram. Feche e atualize o feed.
                    </Text>
                  )}
                  <Text style={s.helper}>
                    Seu texto fica salvo como rascunho neste dispositivo. Ao
                    reiniciar o app, selecione a foto novamente.
                  </Text>
                </>
              )}
              {error && (
                <Text style={s.error} accessibilityRole="alert">
                  {error}
                </Text>
              )}
              {busy && (
                <ActivityIndicator
                  color={colors.brand}
                  style={{ marginTop: 20 }}
                />
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
