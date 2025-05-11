// src/services/apiSlice.ts
import {
  createApi,
  fetchBaseQuery,
  FetchArgs,
  BaseQueryApi,
  FetchBaseQueryError, // Import FetchBaseQueryError for type checking error details
} from "@reduxjs/toolkit/query/react";
import { Mutex } from "async-mutex";
import { logout, setAuthData } from "../store/authSlice"; // Adjust path if needed
import {
  User,
  RefreshTokenResponse, // Assuming this type is correct if your refresh endpoint returns more than tokens
  BaseQueryExtraOptions,
  LoginCredentials,
  LoginResponse, // Assuming this type is correct for your login endpoint response
  TokensPayload, // Type for the token structure in Redux state
  LoginApiResponseTokens, // Assuming this type is correct for nested tokens from your API
  AuthDataPayload, // Assuming this type is correct for the setAuthData action payload
} from "../types"; // Adjust path if needed
import { BASE_URL } from "@/src/utils/constants";
import { RootState } from "../store/store"; // Import RootState type (no 'store' value import)

// Create a new mutex to prevent multiple token refresh attempts at once
const mutex = new Mutex();

// Create a base query instance
const baseQuery = fetchBaseQuery({
  baseUrl: BASE_URL, // <--- Replace with your actual API base URL
  prepareHeaders: (headers, { getState, extra }) => {
    const state = getState() as RootState; // Type getState result
    const accessToken = state.auth.accessToken;
    const typedExtra = extra as BaseQueryExtraOptions | undefined; // Type extra

    // If we have a token AND this is NOT the refresh request AND NOT explicitly an unauthenticated request, add the auth header
    // requiresAuth defaults to true, so we check if it's explicitly false
    if (
      accessToken &&
      typedExtra?.isRefresh !== true &&
      typedExtra?.requiresAuth !== false
    ) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    return headers;
  },
});

// Custom base query that handles re-authentication
const baseQueryWithReauth = async (
  args: string | FetchArgs,
  api: BaseQueryApi, // This provides getState and dispatch
  extraOptions: BaseQueryExtraOptions = {} // Default to empty object
) => {
  const typedExtra = extraOptions as BaseQueryExtraOptions; // Cast for easier access

  // Skip 401 handling for endpoints that explicitly don't require auth (like login)
  if (typedExtra?.requiresAuth === false && typedExtra?.isRefresh !== true) {
    // Just perform the request and return the result without checking for 401
    return baseQuery(args, api, extraOptions);
  }

  // For authenticated endpoints, wait until the mutex is available without locking it
  await mutex.waitForUnlock();

  // Perform the original request
  let result = await baseQuery(args, api, extraOptions);

  // Check if the request failed with a 401 error (including parsing errors over 401)
  const isUnauthorized =
    result.error &&
    (result.error.status === 401 || // Standard 401 status
      (result.error.status === "PARSING_ERROR" && // Or a parsing error...
        // ...where the original HTTP status was 401
        (result.error as any)?.originalStatus === 401)); // Need to cast for originalStatus

  if (isUnauthorized) {
    console.log(
      "Unauthorized error (status 401 or parsing error over 401) - Attempting token refresh..."
    );

    // acquire the mutex to block other requests from refreshing
    const release = await mutex.acquire();

    try {
      const state = api.getState() as RootState; // Get the current state using api.getState()
      const refreshToken = state.auth.refreshToken;

      // Check if a refresh attempt is still needed after acquiring the mutex
      // Another request might have successfully refreshed in the meantime
      // This check should use the state *after* acquiring the mutex
      const stateAfterMutex = api.getState() as RootState;
      if (stateAfterMutex.auth.accessToken) {
        console.log(
          "Token already refreshed by another request while waiting for mutex. Retrying original request."
        );
        // Token is already refreshed, release mutex and retry the original query
        release();
        result = await baseQuery(args, api, extraOptions); // Retry original query
      } else if (!refreshToken) {
        // If there's no access token and no refresh token, cannot refresh
        console.error(
          "No refresh token found after mutex release. Refresh not possible."
        );
        api.dispatch(logout()); // Ensure logged out state
        return result; // Return the original 401 or parsing error
      } else {
        // Proceed with the refresh because no valid access token was found after mutex lock
        console.log("Proceeding with token refresh...");
        const refreshResult = await baseQuery(
          {
            url: "/refresh-token", // <--- Your refresh token endpoint
            method: "POST",
            body: {
              refreshToken: refreshToken, // <--- Body structure might vary based on your API
            },
          },
          api,
          {
            ...extraOptions,
            isRefresh: true, // Mark this request as the refresh request
            requiresAuth: false, // Refresh endpoint usually doesn't require auth header itself
          } as BaseQueryExtraOptions // Cast extraOptions
        );

        // --- Handle Refresh Response ---
        // Assuming the refresh response returns new tokens, potentially nested or flat
        const refreshTokensData = refreshResult.data as
          | { tokens?: LoginApiResponseTokens } // Example: { tokens: { access_token, refresh_token } }
          | TokensPayload // Example: { accessToken, refreshToken } (if backend returns camelCase)
          | undefined; // Handle potential empty or unexpected response

        let newAccessToken: string | null = null;
        let newRefreshToken: string | null = null;

        if (
          refreshTokensData &&
          "tokens" in refreshTokensData &&
          refreshTokensData.tokens // Ensure tokens property exists and is not null/undefined
        ) {
          // Extract from nested snake_case structure
          newAccessToken = refreshTokensData.tokens.access_token;
          newRefreshToken = refreshTokensData.tokens.refresh_token;
        } else if (refreshTokensData && "accessToken" in refreshTokensData) {
          // Handle case where refresh endpoint might return camelCase directly
          newAccessToken = (refreshTokensData as TokensPayload).accessToken; // Cast to TokensPayload for direct access
          newRefreshToken = (refreshTokensData as TokensPayload).refreshToken;
        }
        // --- End Handle Refresh Response ---

        if (newAccessToken && newRefreshToken) {
          console.log(
            "Token refresh successful. Updating tokens and retrying original request."
          );

          // Get the current user data from state *after* successful refresh, before dispatching
          const currentStateAfterRefresh = api.getState() as RootState;
          const currentUserDataAtRefresh = currentStateAfterRefresh.auth.user; // This is User | null

          // Dispatch setAuthData with both new tokens and the current user data
          if (currentUserDataAtRefresh !== null) {
            api.dispatch(
              setAuthData({
                tokens: {
                  // Nested tokens as per AuthDataPayload
                  accessToken: newAccessToken,
                  refreshToken: newRefreshToken,
                },
              })
            );

            // Retry the original query with the new tokens (prepareHeaders will use the updated state)
            result = await baseQuery(args, api, extraOptions);
          } else {
            // This is an unusual state - refresh succeeded but user data is missing
            console.error(
              "Token refresh succeeded, but user data is unexpectedly null in state. Logging out."
            );
            api.dispatch(logout()); // Log out if user data is missing
            // Return an error indicating the problem
            result = {
              error: { status: 401, data: "User data missing after refresh" },
            }; // Example error format
          }
        } else {
          console.error(
            "Token refresh failed or returned unexpected structure.",
            refreshResult
          );
          // If refresh failed or didn't return tokens, log out the user
          api.dispatch(logout());
          // Return the error from the refresh attempt
          result = refreshResult;
        }
      } // End else block for proceeding with refresh
    } finally {
      // release the mutex whether or not the refresh was successful
      release();
    }
  }

  // Return the result of the original request (or the retry, or the refresh error)
  return result;
};

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth, // Use our custom base query
  endpoints: (builder) => ({
    // Example endpoint to get user data (requires auth by default)
    getUser: builder.query<User, string>({
      query: (username) => `/user/${username}`,
      // ...
    }),

    // Login Mutation
    login: builder.mutation<LoginResponse, LoginCredentials>({
      // Type response and payload
      query: (credentials) => ({
        url: "/login", // <--- Your login endpoint
        method: "POST",
        body: credentials,
        // Add extra option to tell baseQueryWithReauth NOT to apply 401 refresh logic
        extraOptions: { requiresAuth: false } as BaseQueryExtraOptions,
      }),
      // Use onQueryStarted to handle the side effect (dispatching setAuthData)
      async onQueryStarted(credentials, { dispatch, queryFulfilled }) {
        try {
          // 'data' will be of type LoginResponse { tokens: { access_token, refresh_token }, user: {...} }
          const { data } = await queryFulfilled;
          console.log("Login successful, received data structure:", data);

          // --- CORRECTLY EXTRACT TOKENS BASED ON API RESPONSE STRUCTURE ---
          // Assuming login response has tokens nested and snake_case
          const accessToken = data.tokens.access_token;
          const refreshToken = data.tokens.refresh_token;

          // Assuming login response also includes the user data at the top level
          const userData = data.user;
          // --- End Extraction ---

          if (accessToken && refreshToken && userData) {
            console.log(
              "Extracted tokens and user data, dispatching setAuthData."
            );
            // Dispatch setAuthData with tokens AND user data
            dispatch(
              setAuthData({
                tokens: {
                  // Nested tokens (camelCase for Redux state)
                  accessToken: accessToken,
                  refreshToken: refreshToken,
                },
                user: userData, // Include user data from login response
              })
            );
            // The _layout.tsx or similar navigation logic should watch the isAuthenticated state from Redux
            // and handle navigation based on that state change (e.g., redirect to dashboard).
          } else {
            console.error(
              "Login successful but token data or user data was missing or unexpected in response."
            );
            // Optionally dispatch logout or handle this as an error if tokens/user are mandatory
            dispatch(logout()); // Log out if essential data is missing
          }
        } catch (error) {
          console.error("Login failed in onQueryStarted:", error);
          // Errors like invalid credentials will typically be handled by the component
          // consuming the useLoginMutation hook (via the error property),
          // but you could dispatch global notification actions here if needed.
          // Ensure logout on login failure as a safety measure if not handled elsewhere
          // dispatch(logout()); // Optional: May depend on desired UX for login failure
        }
      },
    }),
    // Add other endpoints here...
  }),
});

// Export typed hooks for use in components
export const { useGetUserQuery, useLoginMutation } = apiSlice;
