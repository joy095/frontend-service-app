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
    firstName: string;
    lastName: string;
    // Add other properties here that match your API's nested user object for the *authenticated* user
    // This might include more fields than the RegisteredUser
}

// Define the structure of the user data returned ONLY from the registration endpoint
export interface RegisteredUser {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    username: string;
    // This should match the exact fields returned by your /register endpoint's successful response
}


export interface CheckUsernameAvailabilityResponse {
    available: boolean;
    message?: string; // Optional message for why it's not available (e.g., "Username taken", "Contains bad words")
}

export interface CheckUsernameAvailabilityRequest {
    username: string;
}

// This type defines the structure of the *entire API response* for the getUser query
export interface GetUserResponse {
    user: User; // The response has a 'user' property containing UserData (for authenticated user)
}

export interface BaseQueryExtraOptions {
    isRefresh?: boolean;
    requiresAuth?: boolean; // Flag to indicate if an endpoint requires authentication (default true)
}

// --- Updated Login & API Response Types ---

// Define the structure of the tokens object *inside* the login response
export interface LoginApiResponseTokens {
    accessToken: string; // Note the snake_case keys from your API (if applicable, adjust based on your API)
    refreshToken: string;
    // Add other token-related fields if present in your API response
}

// Define the structure of the *full* successful login response
export interface LoginResponse {
    tokens: LoginApiResponseTokens; // The nested tokens object
    user: User; // The authenticated user data object
    // Add any other top-level fields from your API response
}

export interface LoginCredentials {
    username: string; // Assuming your component uses 'username' input
    password: string;
    // Add any other fields required for login (e.g., deviceId)
}

// Payload for setting authenticated auth data
export interface AuthDataPayload {
    tokens: TokensPayload; // Access and Refresh tokens (camelCase for Redux)
    user: User; // The authenticated User object
    isAuthenticated: boolean;
}

// *** FIX: Update AuthState to include registeredUser and isRegistered properties ***
export interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    user: User | null; // State for the fully authenticated user
    isHydrated: boolean; // Initial state

    // --- New state properties for registered but not verified user ---
    registeredUser: RegisteredUser | null; // State for the user after initial registration
    isRegistered: boolean; // Flag to indicate successful registration (before verification)
}

// Define the structure of the *entire API response* for the register endpoint
export interface RegisterResponse {
    // This should match the exact top-level structure of your /register successful response
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    username: string;
    // If your backend returns nested like { user: {...} }, adjust this:
    // user: RegisteredUser;
}


export interface RegisterRequest {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    password: string;
}