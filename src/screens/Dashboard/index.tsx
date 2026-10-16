import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Reveal, useReducedMotion } from "../Home/motion";
import { dashboardStyles as d } from "./styles";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App";
import api, { apiError, imageUrl } from "../../api/api";
import { userType } from "../Home/model";
import type { Person } from "../Home/model";
import { colors, styles as s } from "../Home/styles";
import { useDashboard } from "./useDashboard";
import { currentMonth, monthLabel, shiftMonth } from "./model";
export default function Dashboard({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "Dashboard">) {
  const reduced = useReducedMotion();
  const [person, setPerson] = useState<Person | null>(null);
  const [checking, setChecking] = useState(true);
  const [authError, setAuthError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setChecking(true);
    setAuthError("");
    void api
      .get("/auth/me")
      .then((response) => {
        if (!active) return;
        const user = response.data.user;
        if (userType(user) !== "ORGANIZACAO") {
          navigation.reset({ index: 0, routes: [{ name: "Home" }] });
          return;
        }
        setPerson(user);
      })
      .catch((error) => {
        if (active) setAuthError(apiError(error));
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [navigation, attempt]);
  const dashboard = useDashboard(
    userType(person) === "ORGANIZACAO",
    Number(person?.id_pessoa ?? person?.id_pessoa_login ?? 0),
  );
  const data = dashboard.data;
  // Mostra os resultados do mês escolhido.
  const metrics = data ? [
    { label: "Pessoas que curtiram", value: data.pessoas_curtiram, copy: "Pessoas únicas no mês.", icon: "people-outline" as const },
    { label: "Curtidas no mês", value: data.curtidas_mes, copy: "Curtidas do período ainda ativas.", icon: "heart-outline" as const },
    { label: "Organização nos favoritos", value: data.pessoas_favoritaram_total, copy: "Total atual de clientes que favoritaram.", icon: "star-outline" as const },
    { label: "Novos favoritos no mês", value: data.novos_favoritos_mes, copy: "Favoritos ativos com data registrada.", icon: "calendar-outline" as const },
  ] : [];
  return (
    <View style={s.page}>
      <ScrollView contentContainerStyle={d.content}>
        <TouchableOpacity style={s.row} onPress={() => navigation.popTo("Home", { favoritos: false })}>
          <Ionicons name="arrow-back" size={20} color={colors.ink} /><Text style={s.textButton}>Voltar para o feed</Text>
        </TouchableOpacity>
        <Reveal reduced={reduced}><View style={d.hero}>
          <Text style={d.eyebrow}>RESULTADOS DO SEU NEGÓCIO</Text>
          <Text style={d.title}>Seu negócio, em números.</Text>
          <Text style={d.copy}>Acompanhe quem interage com seus posts e mantém sua organização por perto.</Text>
        </View></Reveal>
        <View style={d.period}>
          <TouchableOpacity style={s.iconButton} accessibilityLabel="Mês anterior" disabled={dashboard.month <= "2000-01"} onPress={() => dashboard.setMonth(shiftMonth(dashboard.month, -1))}><Ionicons name="chevron-back" size={20} color={colors.ink} /></TouchableOpacity>
          <Text style={d.month}>{monthLabel(dashboard.month)}</Text>
          <TouchableOpacity style={[s.iconButton, dashboard.month >= currentMonth() && { opacity: 0.4 }]} accessibilityLabel="Próximo mês" disabled={dashboard.month >= currentMonth()} onPress={() => dashboard.setMonth(shiftMonth(dashboard.month, 1))}><Ionicons name="chevron-forward" size={20} color={colors.ink} /></TouchableOpacity>
        </View>
        {checking || dashboard.loading ? <ActivityIndicator color={colors.brand} accessibilityLabel="Carregando resultados" /> : authError || dashboard.error ? <View><Text style={s.error} accessibilityRole="alert">{authError || dashboard.error}</Text><TouchableOpacity style={s.primary} onPress={() => authError ? setAttempt(a => a + 1) : dashboard.refresh()}><Text style={s.primaryText}>Tentar novamente</Text></TouchableOpacity></View> : data && <>
          <View style={d.grid}>{metrics.map(metric => <View style={d.metric} key={metric.label}>
            <View style={d.icon}><Ionicons name={metric.icon} size={22} color={colors.ink} /></View>
            <Text style={d.metricLabel}>{metric.label}</Text><Text style={d.number}>{metric.value.toLocaleString("pt-BR")}</Text><Text style={d.copy}>{metric.copy}</Text>
          </View>)}</View>
          <Reveal reduced={reduced}><View style={d.best}>
            <View style={d.bestHeader}><View style={d.icon}><Ionicons name="trophy-outline" size={22} color={colors.ink} /></View><View style={{ flex: 1 }}><Text style={d.eyebrow}>DESTAQUE DO PERÍODO</Text><Text style={d.bestTitle}>Seu post mais curtido</Text></View></View>
            {data.post_mais_curtido ? <>
              {data.post_mais_curtido.vincularImagem && <Image style={d.image} resizeMode="contain" source={{ uri: imageUrl(data.post_mais_curtido.vincularImagem) }} />}
              <Text style={s.postTitle}>{data.post_mais_curtido.titulo}</Text>
              <View style={d.badge}><Ionicons name="heart" size={18} color={colors.brand} /><Text style={s.orgName}>{data.post_mais_curtido.curtidas} curtidas no período</Text></View>
              {data.post_mais_curtido.status === "ARQUIVADO" && <Text style={d.copy}>Publicação arquivada</Text>}
            </> : <><Ionicons name="heart-outline" size={32} color={colors.brand} /><Text style={d.bestTitle}>Seu próximo destaque começa com um post.</Text><Text style={d.copy}>Nenhum post recebeu curtidas neste mês.</Text></>}
          </View></Reveal>
          <View style={d.note}><Ionicons name="information-circle-outline" size={22} color={colors.ink} /><Text style={s.orgName}>Como esses números são contados</Text><Text style={d.copy}>Consideramos curtidas e favoritos que continuam ativos. Cada pessoa é contada uma vez no card de pessoas. Em caso de empate, aparece o post mais recente. Datas seguem o calendário do banco de dados.</Text>{data.favoritos_sem_data > 0 && <Text style={d.copy}>{data.favoritos_sem_data} favoritos antigos sem data entram no total atual, mas não nos novos favoritos do mês.</Text>}</View>
          <TouchableOpacity style={s.primary} onPress={dashboard.refresh}><Text style={s.primaryText}>Atualizar métricas</Text></TouchableOpacity>
        </>}
      </ScrollView>
    </View>
  );
}
