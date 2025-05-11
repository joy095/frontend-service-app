import { BASE_URL } from "./constants";


// --- API Call for Login ---

/**
 * Handles user login by sending username and password to the backend.
 * @param username The user's username.
 * @param password The user's password.
 * @returns A promise resolving to an object containing accessToken and refreshToken.
 * @throws Error if the login fails or the response structure is unexpected.
 */
export const login = async (username: string, password: string): Promise<{ accessToken: string; refreshToken: string }> => {
  try {
    const res = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      // Attempt to parse error message from backend if available
      const errorData = await res.json().catch(() => ({ message: "Login failed" }));
      console.error("Login failed with status:", res.status, "Error data:", errorData);
      throw new Error(errorData.message || "Login failed");
    }

    const data = await res.json();
    // --- ADDED FOR DEBUGGING ---
    console.log("Backend login response data:", data);
    // ---------------------------

    // --- UPDATED: Access tokens from nested 'tokens' object with correct keys ---
    if (data && data.tokens && typeof data.tokens.access_token === 'string' && typeof data.tokens.refresh_token === 'string') {
      // Return the tokens using the expected property names for the frontend functions
      return {
        accessToken: data.tokens.access_token,
        refreshToken: data.tokens.refresh_token
      };
    } else {
      console.error("Backend response did not contain expected 'tokens.access_token' and 'tokens.refresh_token' properties.");
      throw new Error("Invalid response structure from backend");
    }

  } catch (error) {
    console.error("Login API error:", error);
    throw error; // Re-throw the error to be handled by the caller
  }
};

// --- Token Management Functions ---

// Define keys for storing tokens in localStorage (or other storage)
const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken"; // Note: HTTP-only cookies are generally more secure for refresh tokens

/**
 * Stores the access and refresh tokens.
 * Note: For production, consider using HTTP-only cookies for the refresh token for better security against XSS.
 * @param accessToken The access token to store.
 * @param refreshToken The refresh token to store.
 */
export const setTokens = (accessToken: string, refreshToken: string): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken); // Consider HttpOnly cookie instead
  console.log("Tokens set.");
};

/**
 * Retrieves the access token.
 * @returns The access token, or null if not found.
 */
export const getAccessToken = (): string | null => {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

/**
 * Retrieves the refresh token.
 * Note: If using HTTP-only cookies, this function would not be needed on the client-side
 * as the browser automatically sends the cookie with requests to the correct domain.
 * @returns The refresh token, or null if not found.
 */
export const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY); // Consider HttpOnly cookie instead
};

/**
 * Clears the access and refresh tokens from storage (logs out the user).
 */
export const clearTokens = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY); // Also clear the HttpOnly cookie on the backend/server-side if applicable
  console.log("Tokens cleared.");
};

/**
 * Updates the access token using the refresh token.
 * This function assumes you have a backend endpoint for token refresh.
 * @returns A promise resolving to the new access token.
 * @throws Error if the token refresh fails.
 */
export const updateAccessToken = async (): Promise<string> => {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    console.error("No refresh token available. Cannot update access token.");
    // Redirect to login or handle appropriately
    clearTokens(); // Clear any remaining tokens
    throw new Error("No refresh token available");
  }

  try {
    // This assumes a backend endpoint like /refresh-token that accepts the refresh token
    // and returns a new access token (and potentially a new refresh token).
    // The refresh token might be sent in the body, headers, or automatically via HttpOnly cookie.
    const res = await fetch(`${BASE_URL}/refresh-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // If refresh token is NOT an HttpOnly cookie, you might send it here:
        // "Authorization": `Bearer ${refreshToken}`, // Or in the body
      },
      // If refresh token is NOT an HttpOnly cookie, you might send it in the body:
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      // If refresh fails, the refresh token might be invalid or expired.
      // This usually means the user needs to log in again.
      console.error("Failed to refresh token. Refresh token might be invalid or expired.");
      clearTokens(); // Log out the user
      const errorData = await res.json().catch(() => ({ message: "Failed to refresh token" }));
      throw new Error(errorData.message || "Failed to refresh token");
    }

    const data = await res.json();
    // Assuming the refresh endpoint also returns tokens in a similar structure
    const newAccessToken = data.accessToken || (data.tokens ? data.tokens.access_token : undefined);
    const newRefreshToken = data.refreshToken || (data.tokens ? data.tokens.refresh_token : refreshToken); // Backend might return a new refresh token

    if (typeof newAccessToken !== 'string') {
      console.error("Refresh token response did not contain a valid new access token.");
      clearTokens(); // Log out if refresh response is invalid
      throw new Error("Invalid response from refresh endpoint");
    }

    // Store the new tokens
    setTokens(newAccessToken, newRefreshToken);

    console.log("Access token updated successfully.");
    return newAccessToken;

  } catch (error) {
    console.error("Token refresh error:", error);
    clearTokens(); // Ensure tokens are cleared on refresh failure
    throw error; // Re-throw the error
  }
};

// --- Example Usage (Illustrative) ---

/*
// Example of using login and setting tokens
const handleLogin = async (username, password) => {
  try {
    const { accessToken, refreshToken } = await login(username, password);
    setTokens(accessToken, refreshToken);
    // Redirect user to dashboard or protected area
    console.log("Login successful, tokens stored.");
  } catch (error) {
    // Display login error message to the user
    console.error("Login failed:", error.message);
  }
};

// Example of making an authenticated request
const fetchProtectedData = async () => {
  const accessToken = getAccessToken();

  if (!accessToken) {
    console.warn("No access token, user not logged in or token cleared.");
    // Redirect to login
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/protected-resource`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        console.warn("Access token expired or unauthorized. Attempting to refresh...");
        try {
          const newAccessToken = await updateAccessToken();
          console.log("Retrying request with new access token...");
          // Retry the original request with the new token
          const retryRes = await fetch(`${BASE_URL}/protected-resource`, {
            headers: {
              "Authorization": `Bearer ${newAccessToken}`,
            },
          });
          if (!retryRes.ok) {
             // If retry fails, something is wrong, likely refresh token invalid
             console.error("Retry with new token failed.");
             clearTokens(); // Log out
             throw new Error("Retry with new token failed");
          }
          const data = await retryRes.json();
          console.log("Protected data after refresh:", data);
          return data;

        } catch (refreshError) {
          console.error("Failed to refresh token and retry:", refreshError);
          // Refresh failed, user needs to re-authenticate
          // Redirect to login
        }
      } else {
        // Handle other API errors
        throw new Error(`Error fetching protected data: ${res.status}`);
      }
    } else {
      const data = await res.json();
      console.log("Protected data:", data);
      return data;
    }
  } catch (error) {
    console.error("Error fetching protected data:", error);
    // Handle network errors or other exceptions
  }
};

// Example of logging out
const handleLogout = () => {
  clearTokens();
  // Redirect user to login page
  console.log("Logged out.");
};
*/



/**
 * Register a new user with provided credentials.
 * @param username - The new user's username.
 * @param password - The new user's password.
 * @returns Server response (success or additional data).
 */
export const register = async (
  username: string,
  password: string,
  email: string
) => {
  const res = await fetch(`${BASE_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, email }),
  });

  if (!res.ok) {
    throw new Error("Register failed");
  }

  return res.json(); // could be: { success: true }
};
