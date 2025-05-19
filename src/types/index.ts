// src/types.ts

// This represents the structure we store in Redux and use as the payload for setAuthData tokens
export interface TokensPayload {
    accessToken: string;
    refreshToken: string;
}

// Response structure for the /refresh-token endpoint
export interface RefreshTokenResponse extends TokensPayload {
    // Add any other fields your refresh endpoint might return that you want in Redux state
    // e.g., user: User; // If your refresh endpoint also returns updated user data
    user?: User; // Optional user data if the refresh endpoint returns it
}

// Define the structure for the authenticated User object
export interface User {
    email: string;
    id: string; // Assuming a user ID
    username: string;
    firstName: string;
    lastName: string;
}

// Define the structure of the user data returned ONLY from the registration endpoint
// This might be a subset of the full User data.
export interface RegisteredUser {
    id: string; // Assuming an ID is returned even on registration
    firstName: string;
    lastName: string;
    email: string;
    username: string;
}


// Response structure for the /username-availability endpoint
export interface CheckUsernameAvailabilityResponse {
    available: boolean;
    message?: string; // Optional message for why it's not available (e.g., "Username taken", "Contains bad words")
}

// Request structure for the /username-availability endpoint
export interface CheckUsernameAvailabilityRequest {
    username: string;
}

// This type defines the structure of the *entire API response* for the getUser query
// Based on the apiSlice, it expects a nested 'user' property
export interface GetUserResponse {
    user: User; // The response has a 'user' property containing the authenticated User data
    // Add any other top-level fields the getUser endpoint might return
    // Example: status: string;
}

// Custom extra options for RTK Query baseQuery
export interface BaseQueryExtraOptions {
    isRefresh?: boolean; // Flag to indicate if this is the token refresh request
    requiresAuth?: boolean; // Flag to indicate if an endpoint requires authentication (default true)
}

// --- Updated Login & API Response Types ---

// Define the structure of the tokens object *inside* the login response
// Adjust key names (camelCase vs snake_case) based on your actual API response
export interface LoginApiResponseTokens {
    accessToken: string;
    refreshToken: string;
    // Add other token-related fields if present in your API response
}

// Define the structure of the *full* successful login response
export interface LoginResponse {
    tokens: LoginApiResponseTokens; // The nested tokens object
    user: User; // The authenticated user data object returned on login
    // Add any other top-level fields from your API response
    // Example: message: string;
}

// Request structure for the /login endpoint
export interface LoginCredentials {
    username: string; // Assuming your component uses 'username' input
    password: string;
    // Add any other fields required for login (e.g., deviceId)
}

// Payload structure for the setAuthData Redux action
export interface AuthDataPayload {
    tokens: TokensPayload; // Access and Refresh tokens (camelCase for Redux state and storage)
    user: User | null; // The authenticated User object (can be null if fetching fails)
    isAuthenticated: boolean; // Flag indicating if the user is authenticated
}

// *** FIX: Update AuthState to include registeredUser and isRegistered properties ***
// Define the overall structure of the authentication state in Redux
export interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean; // True if fully authenticated with tokens and user data
    user: User | null; // State for the fully authenticated user (null if not authenticated or failed to fetch)
    isHydrated: boolean; // Flag indicating if hydration from storage is complete

    // --- New state properties for registered but not verified user ---
    registeredUser: RegisteredUser | null; // State for the user after initial registration (null if not in this state)
    isRegistered: boolean; // Flag to indicate successful registration (before verification/login)
}

// Define the structure of the *entire API response* for the /register endpoint
// Assuming the backend returns the RegisteredUser structure directly at the top level
export interface RegisterResponse extends RegisteredUser {
    // If your backend returns nested like { user: {...} }, adjust this:
    // user: RegisteredUser;
}

// Request structure for the /register endpoint
export interface RegisterRequest {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    password: string;
    // Add any other fields required for registration
}

// Request structure for the /verify-otp endpoint
export interface VerifyOtpRequest {
    email: string;
    otp: string;
    username: string; // Assuming username is also required for verification
}

// Response payload for /verify-otp endpoint
// Assuming it directly returns the access and refresh tokens
export interface VerifyOtpResponse {
    accessToken: string;
    refreshToken: string;
    // Add any other fields your backend might return on successful OTP verification
    // e.g., message: string;
    // user?: User; // If verify OTP endpoint returns user data directly
}