import AsyncStorage from "@react-native-async-storage/async-storage";

export const storeTokens = async (access: string, refresh: string) => {
  await AsyncStorage.setItem("accessToken", access);
  await AsyncStorage.setItem("refreshToken", refresh);
};

export const getAccessToken = async () => {
  return AsyncStorage.getItem("accessToken");
};

export const clearTokens = async () => {
  await AsyncStorage.removeItem("accessToken");
  await AsyncStorage.removeItem("refreshToken");
};
