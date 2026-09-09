import AsyncStorage from "@react-native-async-storage/async-storage";

const ACCESS_TOKEN = "@TaDaKi:access_token";
const REFRESH_TOKEN = "@TaDaKi:refresh_token";

export async function salvarTokens(
  accessToken: string,
  refreshToken: string
) {
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN, accessToken],
    [REFRESH_TOKEN, refreshToken],
  ]);
}

export async function pegarAccessToken() {
  return await AsyncStorage.getItem(ACCESS_TOKEN);
}

export async function pegarRefreshToken() {
  return await AsyncStorage.getItem(REFRESH_TOKEN);
}

export async function removerTokens() {
  await AsyncStorage.multiRemove([
    ACCESS_TOKEN,
    REFRESH_TOKEN,
  ]);
}