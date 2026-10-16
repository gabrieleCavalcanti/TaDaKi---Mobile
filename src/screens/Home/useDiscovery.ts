import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../api/api";

import type { Post, FavoriteMap } from "./model";
import { rows } from "./model";
import { validUF, addConsumption, cleanHistory, loadLocations, recommendations } from "./recommendations";
import type { Consumption, Locations, Address } from "./recommendations";
const emptyLocations: Locations = {user: [], organizations: {}};
export function useDiscovery(id: number, posts: Post[], likes: Set<number>, favorites: FavoriteMap, personalized: boolean) {
  const key = `tadaki:consumption:${id}`;
  const regionKey = `tadaki:region:${id}`;
  const [reference, setReference] = useState<{key: string; address: Address | null}>({key: "", address: null});
  const [history, setHistory] = useState<{key: string; events: Consumption[]}>({key: "", events: []});
  const historyRef = useRef(history);
  const writes = useRef(Promise.resolve());
  const [location, setLocation] = useState<{id: number; data: Locations; loading: boolean}>({id: 0, data: {user: [], organizations: {}}, loading: false});
  useEffect(() => {
    let active = true;
    const empty = {key, events: [] as Consumption[]}; historyRef.current = empty; setHistory(empty);
    if (id > 0) void AsyncStorage.getItem(key).then(raw => {if (active) {let events: Consumption[] = []; try {events = cleanHistory(JSON.parse(raw || "[]"));} catch {} const value = {key, events}; historyRef.current = value; setHistory(value);}}).catch(() => {});
    return () => { active = false; };
  }, [key, id]);
  useEffect(() => {
    let active = true;
    setLocation({id, data: {user: [], organizations: {}}, loading: id > 0 && posts.length > 0});
    if (id > 0 && posts.length) void loadLocations(id, posts, async personId => {
      const response = (await api.get(`/enderecos?id_pessoa=${personId}`, {timeout: 8000})).data;
      return rows<Address>(response, ["enderecoPessoa", "enderecos", "data"]);
    }, () => active).then(data => { if (active) setLocation({id, data, loading: false}); });
    return () => { active = false; };
  }, [id, posts]);
  useEffect(() => {
    let active = true;
    setReference({key: regionKey, address: null});
    if (id > 0) void AsyncStorage.getItem(regionKey).then(raw => {
      if (!active) return;
      try { const saved = JSON.parse(raw || "null");
        if (saved && typeof saved.municipio === "string" && saved.municipio.trim() && typeof saved.uf === "string" && validUF(saved.uf))
          setReference({key: regionKey, address: {municipio: saved.municipio, uf: saved.uf, bairro: typeof saved.bairro === "string" ? saved.bairro : "", rua: typeof saved.rua === "string" ? saved.rua : ""}});
      } catch {}
    }).catch(() => {});
    return () => {active = false;};
  }, [id, regionKey]);
  const saveReference = useCallback(async (address: Address) => {
    if (!id) throw new Error("Aguarde a identificação da sua conta.");
    await AsyncStorage.setItem(regionKey, JSON.stringify(address));
    setReference({key: regionKey, address});
  }, [id, regionKey]);
  const record = useCallback((post: Post, kind: Consumption["kind"]) => {
    if (!id || historyRef.current.key !== key) return;
    const next = addConsumption(historyRef.current.events, post, kind);
    const value = {key, events: next}; historyRef.current = value; setHistory(value);
    writes.current = writes.current.then(() => AsyncStorage.setItem(key, JSON.stringify(next))).then(() => {}).catch(() => {});
  }, [id, key]);
  const registered = location.id === id ? location.data : emptyLocations;
  const selectedAddress = reference.key === regionKey ? reference.address : null;
  const locations = useMemo(() => selectedAddress ? {...registered, user: [selectedAddress]} : registered, [registered, selectedAddress]);
  const result = useMemo(() => recommendations(posts, likes, favorites, history.key === key ? history.events : [], locations, personalized), [posts, likes, favorites, history, key, locations, personalized]);
  return {...result, record, locations, locating: location.loading, selectedAddress, saveReference};
}
