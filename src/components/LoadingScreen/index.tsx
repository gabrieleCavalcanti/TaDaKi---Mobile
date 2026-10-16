import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
export default function LoadingScreen({ reduced = false }: { reduced?: boolean }) {
  return <SafeAreaView style={s.page}><View style={s.card} accessibilityRole="progressbar" accessibilityLabel="Carregando publicações"><Image source={require("../../assets/logoTaDaKi.webp")} style={s.logo} resizeMode="contain" /><ActivityIndicator size="large" color="#B01013" animating={!reduced} /><Text style={s.title}>Suas próximas descobertas estão chegando.</Text><Text style={s.copy}>Carregando seu TaDaKi.</Text><View style={s.line} /><Text style={s.copy}>Pertinho de você. Feito por gente.</Text></View></SafeAreaView>;
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "white", justifyContent: "center", padding: 24 },
  card: { padding: 30, borderWidth: 1, borderColor: "#E0E6EC", borderRadius: 24, alignItems: "center", gap: 22 },
  logo: { width: 150, height: 70 },
  title: { fontSize: 23, fontWeight: "800", color: "#252D36", textAlign: "center", lineHeight: 31 },
  copy: { fontSize: 12, color: "#444A52", textAlign: "center", lineHeight: 19 },
  line: { backgroundColor: "#A2B9D5", width: 140, height: 4, borderRadius: 5 },
});
