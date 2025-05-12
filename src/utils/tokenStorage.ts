// src/utils/tokenStorage.ts
import * as SecureStore from "expo-secure-store"; // Import as * as SecureStore

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

export async function saveTokens(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  try {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    console.log("Tokens saved to secure storage.");
  } catch (error) {
    console.error("Error saving tokens to secure storage:", error);
    throw error; // Re-throw to be caught by the listener effect
  }
}

export async function deleteTokens(): Promise<void> {
  try {
    // *** FIX: Use SecureStore.deleteItemAsync ***
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    console.log("Tokens deleted from secure storage.");
  } catch (error) {
    console.error("Error deleting tokens from secure storage:", error);
    throw error; // Re-throw to be caught by the listener effect
  }
}

export async function getTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  try {
    const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    console.log("Tokens retrieved from secure storage.");
    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Error retrieving tokens from secure storage:", error);
    return { accessToken: null, refreshToken: null };
  }
}
