import { useEffect, useState } from "react";
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
  return (
    <SafeAreaView style={s.page}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>
        <TouchableOpacity
          style={{ paddingVertical: 12 }}
          onPress={() => navigation.popTo("Home", { favoritos: false })}
        >
          <Text style={s.textButton}>← Voltar para a Home</Text>
        </TouchableOpacity>
        <Text style={s.eyebrow}>RESULTADOS DO SEU NEGÓCIO</Text>
        <Text style={s.title}>Dashboard</Text>
        <Text style={s.subtitle}>
          Acompanhe a relação da comunidade com seus produtos.
        </Text>
        <View
          style={[
            s.row,
            { justifyContent: "space-between", marginVertical: 20 },
          ]}
        >
          <TouchableOpacity
            style={s.iconButton}
            accessibilityLabel="Mês anterior"
            disabled={dashboard.month <= "2000-01"}
            onPress={() => dashboard.setMonth(shiftMonth(dashboard.month, -1))}
          >
            <Text>‹</Text>
          </TouchableOpacity>
          <Text style={{ fontWeight: "700", color: colors.ink }}>
            {monthLabel(dashboard.month)}
          </Text>
          <TouchableOpacity
            style={s.iconButton}
            accessibilityLabel="Próximo mês"
            disabled={dashboard.month >= currentMonth()}
            onPress={() => dashboard.setMonth(shiftMonth(dashboard.month, 1))}
          >
            <Text>›</Text>
          </TouchableOpacity>
        </View>
        {checking || dashboard.loading ? (
          <ActivityIndicator
            color={colors.brand}
            accessibilityLabel="Carregando resultados"
          />
        ) : authError || dashboard.error ? (
          <View>
            <Text style={s.error}>{authError || dashboard.error}</Text>
            <TouchableOpacity
              style={s.primary}
              onPress={() =>
                authError ? setAttempt((a) => a + 1) : dashboard.refresh()
              }
            >
              <Text style={s.primaryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : (
          data && (
            <>
              {[
                [
                  "Pessoas que curtiram no mês",
                  data.pessoas_curtiram,
                  "Cada pessoa é contada uma vez, mesmo curtindo vários posts.",
                ],
                [
                  "Curtidas no mês",
                  data.curtidas_mes,
                  "Curtidas que continuam ativas no período.",
                ],
                [
                  "Pessoas que favoritaram",
                  data.pessoas_favoritaram_total,
                  "Total atual de clientes que favoritaram sua empresa.",
                ],
                [
                  "Novos favoritos no mês",
                  data.novos_favoritos_mes,
                  "Favoritos com data conhecida que continuam ativos.",
                ],
              ].map(([label, value, copy]) => (
                <View
                  key={String(label)}
                  style={{
                    backgroundColor: "white",
                    borderWidth: 1,
                    borderColor: colors.line,
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 12,
                  }}
                >
                  <Text style={s.orgName}>{label}</Text>
                  <Text
                    style={{
                      fontSize: 38,
                      fontWeight: "800",
                      color: colors.brand,
                      marginVertical: 8,
                    }}
                  >
                    {value}
                  </Text>
                  <Text style={s.helper}>{copy}</Text>
                </View>
              ))}
              <View
                style={{
                  backgroundColor: "white",
                  borderWidth: 1,
                  borderColor: colors.line,
                  borderRadius: 16,
                  padding: 20,
                  marginTop: 10,
                }}
              >
                <Text style={s.stateTitle}>Post mais curtido no mês</Text>
                {data.post_mais_curtido ? (
                  <>
                    {data.post_mais_curtido.vincularImagem && (
                      <Image
                        style={{
                          height: 180,
                          width: "100%",
                          marginVertical: 15,
                        }}
                        resizeMode="contain"
                        source={{
                          uri: imageUrl(data.post_mais_curtido.vincularImagem),
                        }}
                      />
                    )}
                    <Text style={s.postTitle}>
                      {data.post_mais_curtido.titulo}
                    </Text>
                    <Text style={s.description}>
                      {data.post_mais_curtido.curtidas} curtidas no período
                    </Text>
                    {data.post_mais_curtido.status === "ARQUIVADO" && (
                      <Text style={s.helper}>Publicação arquivada</Text>
                    )}
                  </>
                ) : (
                  <Text style={s.description}>
                    Nenhum post recebeu curtidas neste mês.
                  </Text>
                )}
              </View>
              {data.favoritos_sem_data > 0 && (
                <Text style={[s.helper, { marginTop: 16 }]}>
                  {data.favoritos_sem_data} pessoas têm favoritos antigos sem
                  data registrada. Elas entram no total atual, mas não nos novos
                  favoritos do mês.
                </Text>
              )}
              <Text style={[s.helper, { marginTop: 16 }]}>
                Os resultados consideram curtidas e favoritos que continuam
                ativos. Datas seguem o calendário configurado no banco de dados.
                Em caso de empate, aparece o post mais recente.
              </Text>
              <TouchableOpacity
                style={[s.primary, { marginTop: 20 }]}
                onPress={dashboard.refresh}
              >
                <Text style={s.primaryText}>Atualizar métricas</Text>
              </TouchableOpacity>
            </>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
