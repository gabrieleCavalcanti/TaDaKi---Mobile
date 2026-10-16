import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { styles as s } from "./styles";
import { validUF } from "./recommendations";
import type { Address } from "./recommendations";
export function RegionPicker({initial, save}: {initial?: Address; save: (address: Address) => Promise<void>}) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState<Address>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {if(open) {setAddress(initial ?? {}); setError("");}}, [open, initial]);
  return <View>
    <TouchableOpacity accessibilityState={{expanded: open}} onPress={() => setOpen(!open)} style={{paddingVertical:12}}><Text style={s.textButton}>Definir minha região</Text></TouchableOpacity>
    {open && <View style={{paddingBottom:16}}>
      <Text style={s.helper}>Escolha onde deseja descobrir negócios. A região fica salva para sua conta neste dispositivo.</Text>
      {([["municipio","Cidade"],["uf","Estado (UF)"],["bairro","Bairro (opcional)"],["rua","Rua (opcional)"]] as const).map(([key,label]) => <View key={key}><Text style={s.label}>{label}</Text><TextInput style={s.field} accessibilityLabel={label} value={address[key] ?? ""} maxLength={key === "uf" ? 2 : 120} autoCapitalize={key === "uf" ? "characters" : "words"} editable={!busy} onChangeText={value=>setAddress({...address,[key]:value})}/></View>)}
      {error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
      <TouchableOpacity style={[s.primary,{marginTop:12}]} disabled={busy} onPress={async () => {
        if(busy) return;
        const uf = String(address.uf ?? "").trim().toUpperCase();
        if (!String(address.municipio ?? "").trim() || !validUF(uf)) {setError("Informe a cidade e a sigla do estado, por exemplo SP."); return;}
        setBusy(true); setError("");
        try {await save({...address, municipio: address.municipio!.trim(), uf}); setOpen(false);} catch {setError("Não foi possível salvar a região neste dispositivo.");} finally {setBusy(false);}
      }}><Text style={s.primaryText}>{busy ? "Salvando…" : "Salvar região"}</Text></TouchableOpacity>
    </View>}
  </View>;
}
