// src/types.ts


// This represents the structure we store in Redux and use as the payload for setTokens
export interface TokensPayload {
    accessToken: string;
    refreshToken: string;
}

export interface RefreshTokenResponse extends TokensPayload {
    // Add any other fields your refresh endpoint might return that you want in Redux state
}

export interface User {
    email: string;
    id: string;
    username: string;
    first_name: string;
    last_name: string;
    age: string;
    // Add other properties here that match your API's nested user object
}

// This type defines the structure of the *entire API response* for the getUser query
export interface GetUserResponse {
    user: User; // The response has a 'user' property containing UserData
}

export interface BaseQueryExtraOptions {
    isRefresh?: boolean;
    requiresAuth?: boolean; // Flag to indicate if an endpoint requires authentication (default true)
}

// --- Updated Login & API Response Types ---

// Define the structure of the tokens object *inside* the login response
export interface LoginApiResponseTokens {
    accessToken: string; // Note the snake_case keys from your API
    refreshToken: string;
    // Add other token-related fields if present in your API response
}

// Define the structure of the *full* successful login response
export interface LoginResponse {
    tokens: LoginApiResponseTokens; // The nested tokens object
    user: User; // The user data object
    // Add any other top-level fields from your API response
}

export interface LoginCredentials {
    username: string; // Assuming your component uses 'username' input
    password: string;
    // Add any other fields required for login (e.g., deviceId)
}

// *** FIX: Update AuthDataPayload to explicitly allow null for the user property ***
export interface AuthDataPayload {
    tokens: TokensPayload; // Access and Refresh tokens (camelCase for Redux)
    user?: User | null | undefined; // *** Change this line: Add | null ***
    isAuthenticated?: boolean;
    isHydrated?: boolean; // This is typically managed directly in the slice, not passed in payload
}

// Your AuthState should already allow null for user, which is why currentUserDataAtRefresh is User | null
export interface AuthState {
    accessToken: string | null,
    refreshToken: string | null,
    isAuthenticated: boolean,
    user: User | null, // User can be null in state
    isHydrated: boolean, // Initial state
};