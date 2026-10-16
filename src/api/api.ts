import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  pegarAccessToken,
  pegarRefreshToken,
  salvarTokens,
} from "../storage/authStorage";

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  withCredentials: true,
  timeout: 20000,
});
api.interceptors.request.use(async (config) => {
  if (!api.defaults.baseURL)
    throw new Error(
      "Configure EXPO_PUBLIC_API_URL no arquivo .env com o endereço da API.",
    );
  const token = await pegarAccessToken();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});
let refreshing: Promise<void> | null = null;
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (
      error.response?.status !== 401 ||
      !config ||
      config._retried ||
      /\/auth\/(login|refresh|logout)/.test(config.url || "")
    )
      throw error;
    config._retried = true;
    const refreshToken = await pegarRefreshToken();
    if (!refreshing)
      refreshing = api
        .post("/auth/refresh", refreshToken ? { refreshToken } : {})
        .then(async (response) => {
          // Renova a sessão para continuar usando o aplicativo.
          if (response.data.token_acesso)
            await salvarTokens(response.data.token_acesso, response.data.refresh_token ?? refreshToken ?? "");
          else await AsyncStorage.removeItem("@TaDaKi:access_token");
        })
        .finally(() => {
          refreshing = null;
        });
    await refreshing;
    config.headers.delete("Authorization");
    return api(config);
  },
);
export function imageUrl(name?: string | null) {
  if (!name) return "";
  if (/^https?:\/\//i.test(name)) return name;
  const base = (api.defaults.baseURL || "").replace(/\/$/, "");
  if (name.startsWith("/")) return `${base}${name}`;
  return `${base}/${name.startsWith("images/") ? name : `images/${name}`}`;
}
export function apiError(error: unknown) {
  if (axios.isAxiosError(error))
    return (
      error.response?.data?.message ||
      error.response?.data?.error ||
      (error.code === "ECONNABORTED"
        ? "O servidor demorou para responder. Tente novamente."
        : "Não foi possível conectar com a API.")
    );
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a ação.";
}
export default api;
