import { useState } from "react";
import { ScrollView, Text, Pressable, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App"; // ajuste o caminho se a pasta for diferente

const faq = [
  [
    "Como encontro negócios perto de mim?",
    "Acesse a Home e escolha sua região. Explore as publicações e filtre por categoria.",
  ],
  [
    "Como curtir uma publicação?",
    "Toque no coração de uma publicação. Ela ficará disponível na área de curtidas.",
  ],
  [
    "Como favoritar uma organização?",
    "Use o ícone de favorito nas organizações. Você poderá acompanhar novidades na aba Favoritas.",
  ],
  [
    "Quem pode criar publicações?",
    "Apenas contas cadastradas como organização podem publicar.",
  ],
  [
    "Como criar uma publicação?",
    "Na Home de uma organização, toque em Criar publicação, preencha as informações, escolha uma categoria e adicione uma imagem.",
  ],
  [
    "O que mostra a Dashboard?",
    "Organizações podem consultar curtidas e favoritos registrados na plataforma.",
  ],
  ["Onde está o meu perfil?", "Abra o menu principal e selecione Meu perfil."],
  [
    "Por que um post não aparece?",
    "Verifique os filtros e a região. Publicações arquivadas não aparecem na vitrine.",
  ],
];

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f5f8fc" },
  content: { padding: 20, paddingBottom: 50, gap: 12 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  backText: { color: "#b50917", fontWeight: "700", fontSize: 14 },
  heading: {
    fontSize: 28,
    fontWeight: "800",
    color: "#14253b",
    marginVertical: 17,
  },
  sub: { color: "#60738a", marginBottom: 10 },
  card: { borderRadius: 17, padding: 19, backgroundColor: "#fff" },
  question: { color: "#172b44", fontWeight: "700", fontSize: 16 },
  answer: { marginTop: 13, color: "#60738a", lineHeight: 23 },
});

export default function Ajuda({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "Ajuda">) {
  const [selected, setSelected] = useState<number | null>(0);

  return (
    <SafeAreaView style={st.page} edges={["top"]}>
      <ScrollView contentContainerStyle={st.content}>
        <TouchableOpacity
          style={st.back}
          onPress={() => navigation.popTo("Home", { favoritos: false })}
          accessibilityLabel="Voltar para o feed"
        >
          <Ionicons name="arrow-back" size={20} color="#b50917" />
          <Text style={st.backText}>Voltar para o feed</Text>
        </TouchableOpacity>

        <Text style={st.heading}>Perguntas frequentes</Text>
        <Text style={st.sub}>Tire suas dúvidas sobre o TaDaKi.</Text>

        {faq.map(([q, a], i) => (
          <Pressable
            style={st.card}
            key={q}
            onPress={() => setSelected(selected === i ? null : i)}
            accessibilityRole="button"
          >
            <Text style={st.question}>
              {selected === i ? "− " + q : "+ " + q}
            </Text>
            {selected === i && <Text style={st.answer}>{a}</Text>}
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}