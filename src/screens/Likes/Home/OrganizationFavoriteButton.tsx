import { useCallback, useEffect, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api, { apiError } from "../../api/api";
import { rows, userType } from "./model";
import type { Person } from "./model";
import { styles as s } from "./styles";

export default function OrganizationFavoriteButton({ personId }: { personId: number }) {
  const [client, setClient] = useState(false);
  const [orgId, setOrgId] = useState(0);
  const [favoriteId, setFavoriteId] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const lock = useRef(false);
  const load = useCallback(async () => {
    const run = ++generation.current;
    setBusy(true); setError(""); setOrgId(0); setFavoriteId(0); setClient(false);
    try {
      const me = await api.get("/auth/me");
      if (run !== generation.current) return;
      if (userType(me.data.user) !== "CLIENTE") return;
      setClient(true);
      const [organizations, favorites] = await Promise.all([
        api.get("/pessoas?tipo=ORGANIZACAO"), api.get("/Favoritos"),
      ]);
      if (run !== generation.current) return;
      const id = Number(rows<Person>(organizations.data, ["funcionarios", "pessoas", "data"]).find(p => Number(p.id_pessoa) === personId)?.id_organizacao);
      if (!id) throw new Error("Não foi possível identificar a organização.");
      setOrgId(id);
      const entry = rows<{ id_organizacao: number; id_favorito: number }>(favorites.data, ["resultadoSelecionaTodos", "favoritos"]).find(f => Number(f.id_organizacao) === id);
      setFavoriteId(Number(entry?.id_favorito) || 0);
    } catch (cause) { if (run === generation.current) setError(apiError(cause)); }
    finally { if (run === generation.current) setBusy(false); }
  }, [personId]);
  useEffect(() => { void load(); return () => { generation.current++; }; }, [load]);
  const toggle = async () => {
    if (lock.current || !orgId) return;
    lock.current = true; setBusy(true); setError("");
    const run = generation.current;
    try {
      let next = 0;
      if (favoriteId) await api.delete(`/Favoritos/${favoriteId}`);
      else {
        const result = await api.post("/Favoritos", { id_organizacao: orgId });
        next = Number(result.data.novoRegistro?.insertId ?? result.data.id_favorito);
        if (!next) throw new Error("Atualize os favoritos antes de tentar novamente.");
      }
      if (run === generation.current) setFavoriteId(next);
    } catch (cause) { if (run === generation.current) setError(apiError(cause)); }
    finally { lock.current = false; if (run === generation.current) setBusy(false); }
  };
  if (!client && !error) return null;
  return <View style={{ gap: 8, marginVertical: 10 }}>
    <TouchableOpacity style={[s.social, s.favoriteAction]} accessibilityRole="button" accessibilityState={{ selected: Boolean(favoriteId), disabled: busy }} disabled={busy} onPress={() => void (orgId ? toggle() : load())}>
      <Ionicons name={favoriteId ? "star" : "star-outline"} size={20} color="#557B5D" />
      <Text style={s.socialText}>{busy ? "Carregando…" : !orgId && error ? "Tentar novamente" : favoriteId ? "Organização favorita" : "Favoritar organização"}</Text>
    </TouchableOpacity>
    {error ? <Text accessibilityRole="alert" style={{ color: "#B03636", fontSize: 12 }}>{error}</Text> : null}
  </View>;
}
