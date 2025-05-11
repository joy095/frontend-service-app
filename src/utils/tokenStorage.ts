// src/utils/tokenStorage.ts // Create a utility file for storage

import * as SecureStore from 'expo-secure-store';
// import AsyncStorage from '@react-native-async-storage/async-storage'; // Optional for access token

const ACCESS_TOKEN_KEY = 'myAppAccessToken';
const REFRESH_TOKEN_KEY = 'myAppRefreshToken'; // *** Store refresh token SECURELY ***

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    try {
        // Store refresh token securely
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
        console.log("Refresh token saved securely.");

        // Store access token (securely or in AsyncStorage depending on your choice)
        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken); // Securely store access token
        // OR: await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken); // Less secure option for access token
        console.log("Access token saved.");

    } catch (error) {
        console.error("Failed to save tokens:", error);
        // Handle error (e.g., show alert, log user out)
        throw error; // Re-throw to indicate failure
    }
}

export async function getTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
    try {
        // Retrieve refresh token securely
        const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        console.log("Refresh token retrieved.");


        // Retrieve access token
        const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY); // From secure store
        // OR: const accessToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY); // From AsyncStorage
        console.log("Access token retrieved.");


        return { accessToken, refreshToken };
    } catch (error) {
        console.error("Failed to retrieve tokens:", error);
        // Handle error (e.g., assume no tokens, proceed as logged out)
        return { accessToken: null, refreshToken: null };
    }
}

export async function deleteTokens(): Promise<void> {
    try {
        // Delete refresh token securely
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
        console.log("Refresh token deleted securely.");

        // Delete access token
        await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY); // From secure store
        // OR: await AsyncStorage.removeItem(ACCESS_TOKEN_KEY); // From AsyncStorage
        console.log("Access token deleted.");

    } catch (error) {
        console.error("Failed to delete tokens:", error);
        // Handle error
        throw error; // Re-throw to indicate failure
    }
}