// src/services/apiSlice.ts
import {
  createApi,
  fetchBaseQuery,
  FetchArgs,
  BaseQueryApi,
  FetchBaseQueryError,
  FetchBaseQueryMeta,
  // ... other RTK Query types if needed
} from "@reduxjs/toolkit/query/react";
import { Mutex } from "async-mutex";
// *** Import only the actions needed in apiSlice (logout, setAuthData) ***
import { logout, setAuthData } from "../store/auth/authSlice";
import {
  User, // User type (for nested object, based on API response)
  GetUserResponse, // GetUserResponse type (for the overall getUser API response)
  BaseQueryExtraOptions,
  LoginCredentials,
  LoginResponse, // Assuming this type is correct for your login endpoint response
  TokensPayload, // Type for the token structure in Redux state (camelCase for Redux)
  LoginApiResponseTokens, // Assuming this type is correct for nested tokens from your API (snake_case)
  AuthDataPayload, // Import AuthDataPayload (ensure user property allows User | null | undefined)
} from "../types"; // Adjust path and ensure types match your API and Redux state
import { BASE_URL } from "@/src/utils/constants";
import { RootState } from "../store/store"; // Import RootState type

// *** REMOVE hydrateAuthState ASYNC THUNK FROM HERE ***
// *** It belongs in src/store/auth/authSlice.ts and should use your storage utility ***
// import { createAsyncThunk } from "@reduxjs/toolkit";
// export const hydrateAuthState = createAsyncThunk(...) // Delete this block

// Create a new mutex to prevent multiple token refresh attempts at once
const mutex = new Mutex();

// Create a base query instance
const baseQuery = fetchBaseQuery({
  baseUrl: BASE_URL, // <--- Replace with your actual API base URL
  prepareHeaders: (headers, { getState, extra }) => {
    const state = getState() as RootState; // Type getState result
    const accessToken = state.auth.accessToken;
    const typedExtra = extra as BaseQueryExtraOptions | undefined;

    // If we have a token AND this is NOT the refresh request AND NOT explicitly an unauthenticated request, add the auth header
    // requiresAuth defaults to true, so we check if it's explicitly false
    if (
      accessToken &&
      typedExtra?.isRefresh !== true && // Exclude the refresh request itself
      typedExtra?.requiresAuth !== false // Exclude explicitly unauthenticated requests
    ) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    // Note: The Refresh-Token header for the refresh endpoint is set directly in the baseQuery call in baseQueryWithReauth

    return headers;
  },
});

// Custom base query that handles re-authentication
const baseQueryWithReauth = async (
  args: string | FetchArgs,
  api: BaseQueryApi, // This provides getState and dispatch
  extraOptions: BaseQueryExtraOptions = {} // Default to empty object
) => {
  console.log("baseQueryWithReauth CALLED for:", args); // Log 1

  const typedExtra = extraOptions as BaseQueryExtraOptions;

  // Skip 401 handling for endpoints that explicitly don't require auth (like login)
  if (typedExtra?.requiresAuth === false) {
    console.log(
      "baseQueryWithReauth: Skipping auth/refresh logic for unauthenticated endpoint:",
      args
    ); // Log 2
    // *** baseQuery expects 3 arguments: args, api, extraOptions ***
    return baseQuery(args, api, extraOptions); // Pass extraOptions as the 3rd argument
  }

  // For authenticated endpoints, wait until the mutex is available without locking it
  await mutex.waitForUnlock();
  console.log("baseQueryWithReauth: Mutex unlocked for:", args); // Log 3

  // Perform the original request
  // *** baseQuery expects 3 arguments: args, api, extraOptions ***
  let result = await baseQuery(args, api, extraOptions); // Pass extraOptions as the 3rd argument
  console.log(
    "baseQueryWithReauth: Original request result for",
    args,
    ":",
    result
  ); // Log 4

  // Check if the request failed with a 401 error
  // *** FIX: Explicitly annotate isUnauthorized as boolean ***
  const isUnauthorized: boolean = // Add the type annotation here
    !!result.error && // Ensure result.error is truthy
    !!(
      // Ensure the condition inside is truthy
      (
        result.error.status === 401 ||
        (result.error.status === "PARSING_ERROR" &&
          (result.error as any)?.originalStatus === 401)
      )
    );

  console.log(
    "baseQueryWithReauth: Is Unauthorized?",
    isUnauthorized,
    "for",
    args
  ); // Log 5

  if (isUnauthorized) {
    console.log(
      "baseQueryWithReauth: Unauthorized detected, attempting refresh for:",
      args
    ); // Log 6

    const release = await mutex.acquire();
    console.log("baseQueryWithReauth: Mutex acquired for refresh attempt."); // Log 7

    // Capture the access token that was used in the original failed request
    // This should be the expired token from the state *before* mutex acquisition
    const originalAccessToken = (api.getState() as RootState).auth.accessToken;
    console.log(
      "baseQueryWithReauth: Original Access Token that failed:",
      originalAccessToken ? "Present" : "Missing"
    ); // Log 8

    // *** FIX: Declare refreshToken with let OUTSIDE the try block ***
    let refreshToken: string | null = null;

    try {
      const state = api.getState() as RootState; // Get the current state
      // *** Assign to the variable declared outside ***
      refreshToken = state.auth.refreshToken; // Use assignment here

      const stateAfterMutex = api.getState() as RootState;
      const accessTokenAfterMutex = stateAfterMutex.auth.accessToken;

      console.log(
        "baseQueryWithReauth: Refresh Token in state:",
        refreshToken ? "Present" : "Missing"
      ); // Log 9
      console.log(
        "baseQueryWithReauth: Access Token in state (after mutex acquire):",
        accessTokenAfterMutex ? "Present" : "Missing"
      ); // Log 10

      // *** FIX: Check if the access token is present AND different from the original failed one ***
      if (
        accessTokenAfterMutex &&
        accessTokenAfterMutex !== originalAccessToken
      ) {
        // Path 1: Token has been updated by another request while waiting for mutex
        console.log(
          "baseQueryWithReauth: Path 1 - Token updated by another request while waiting for mutex. Retrying original."
        ); // Log 11
        release(); // Release before retrying
        // *** baseQuery expects 3 arguments: args, api, extraOptions ***
        result = await baseQuery(args, api, extraOptions); // Retry original query
        console.log(
          "baseQueryWithReauth: Result of retried original query (Path 1):",
          result
        ); // Log 12
      } else if (!refreshToken) {
        // *** FIX: refreshToken is now accessible here ***
        // Path 2: No refresh token available
        console.error(
          "baseQueryWithReauth: Path 2 - No refresh token found. Logging out."
        ); // Log 13
        api.dispatch(logout()); // Log out if no refresh token
        // Return the original 401
        result = result; // Keep the original error result
        console.log(
          "baseQueryWithReauth: Returning original error and logging out (Path 2)."
        ); // Log 14
      } else {
        // Path 3: *** Proceed with refresh ***
        console.log(
          "baseQueryWithReauth: Path 3 - Proceeding with token refresh..."
        ); // Log 15

        // *** Log the exact value AND type of refreshToken before using it ***
        console.log(
          "baseQueryWithReauth: Path 3 - refreshToken value:",
          refreshToken,
          "Type:",
          typeof refreshToken
        ); // Log 16 (was Log 20)

        // Make the refresh token request
        // *** Pass an explicit empty object for the third argument to baseQuery for THIS call ***
        const refreshResult = await baseQuery(
          {
            // Arg 1
            url: "/refresh-token",
            method: "POST",
            body: {}, // Using empty object body
            headers: {
              "Refresh-Token": refreshToken, // Using refreshToken here (now guaranteed accessible & hopefully string)
              "Content-Type": "application/json",
            },
            // The extraOptions *for this specific request* are correctly inside FetchArgs
            extraOptions: {
              isRefresh: true,
              requiresAuth: false,
            } as BaseQueryExtraOptions,
          } as FetchArgs, // End Arg 1
          api, // Arg 2
          {} // *** FIX: Pass explicit empty object {} as the third argument here *** // Arg 3
        );
        console.log(
          "baseQueryWithReauth: Refresh request result (Path 3):",
          refreshResult
        ); // Log 17

        // --- Handle Refresh Response (Path 3) ---
        // *** UPDATE: Expect top-level access_token, refresh_token, and user OR top-level accessToken, refreshToken ***
        const refreshResponseData = refreshResult.data as
          | { access_token?: string; refresh_token?: string; user?: User } // Handles top-level snake_case + user (less ideal, but based on previous backend attempt)
          | TokensPayload // *** Handles your current backend response: top-level camelCase ***
          | undefined;

        let newAccessToken: string | null = null;
        let newRefreshToken: string | null = null;
        let newUserData: User | null = null; // Capture user data if present (from the less ideal backend structure)

        if (
          refreshResponseData &&
          refreshResult.meta?.response?.status === 200
        ) {
          // Check for data and status first

          // *** Try extracting from top-level camelCase first (your current ideal backend response) ***
          if (
            "accessToken" in refreshResponseData &&
            "refreshToken" in refreshResponseData
          ) {
            newAccessToken = (refreshResponseData as TokensPayload).accessToken;
            newRefreshToken = (refreshResponseData as TokensPayload)
              .refreshToken;
            // User data is not expected in the ideal refresh response, so newUserData remains null
            console.log(
              "baseQueryWithReauth: Extracted tokens from top-level camelCase (ideal refresh response)."
            ); // Log added
          } else if (
            "access_token" in refreshResponseData &&
            "refresh_token" in refreshResponseData
          ) {
            // Fallback to extracting from top-level snake_case (if backend returns this way, less ideal)
            newAccessToken = (refreshResponseData as any).access_token ?? null; // Use any temporarily or update types if needed
            newRefreshToken =
              (refreshResponseData as any).refresh_token ?? null;
            newUserData = (refreshResponseData as any).user ?? null; // Capture user data if present
            console.log(
              "baseQueryWithReauth: Extracted tokens from top-level snake_case (+ user)."
            ); // Log added
          }

          // Check if tokens were successfully extracted from either format
          if (newAccessToken && newRefreshToken) {
            console.log(
              "baseQueryWithReauth: Refresh successful, new tokens extracted."
            ); // Log 18a

            // Get existing user data from state to preserve it
            const currentStateAfterRefresh = api.getState() as RootState;
            const currentUserDataAtRefresh = currentStateAfterRefresh.auth.user; // User | null

            api.dispatch(
              setAuthData({
                tokens: {
                  accessToken: newAccessToken,
                  refreshToken: newRefreshToken,
                },
                // Use new user data if provided by refresh (from the less ideal structure), otherwise keep existing
                user: newUserData ?? currentUserDataAtRefresh, // Use ?? to prefer newUserData if it exists
                isAuthenticated: true,
              })
            );
            console.log(
              "baseQueryWithReauth: Dispatching setAuthData after refresh success."
            ); // Log 18b

            // Retry the original query
            console.log(
              "baseQueryWithReauth: Retrying original request:",
              args
            ); // Log 19
            result = await baseQuery(args, api, extraOptions); // Retry original query (will use new token from state)
            console.log(
              "baseQueryWithReauth: Result of retried original query (Path 3):",
              result
            ); // Log 20
          } else {
            // Refresh failed: Status 200 but tokens missing from response body in expected formats
            console.error(
              "baseQueryWithReauth: Refresh failed: Status 200 but tokens missing from response body in expected formats.",
              refreshResult.data
            ); // Log 21a
            api.dispatch(logout()); // Log out if tokens weren't in the response
            result = refreshResult; // Return the refresh error
          }
        } else {
          // Refresh failed: Status not 200 or no data received (e.g., network error, server error < 200, parsing error)
          console.error(
            "baseQueryWithReauth: Refresh failed: Status not 200 or no data.",
            refreshResult?.meta?.response?.status,
            refreshResult.data,
            refreshResult.error
          ); // Log 21b
          api.dispatch(logout()); // Log out if refresh failed
          result = refreshResult; // Return the error result
        }
        // --- End Handle Refresh Response (Path 3) ---
      } // End else block for Path 3
    } finally {
      release(); // Always release the mutex
      console.log("baseQueryWithReauth: Mutex released."); // Log 22
    }
  }

  // Return the final result (original error, retry success, retry error, or refresh error)
  return result;
};

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth, // Use our custom base query
  endpoints: (builder) => ({
    // *** Use the correct return type GetUserResponse ***
    getUser: builder.query<GetUserResponse, string>({
      query: (username) => `/user/${username}`,
      extraOptions: { requiresAuth: true } as BaseQueryExtraOptions, // Mark as requiring auth
    }),

    // Login Mutation (does not require auth header for itself)
    login: builder.mutation<LoginResponse, LoginCredentials>({
      query: (credentials) => ({
        url: "/login", // Your login endpoint
        method: "POST",
        body: credentials,
        extraOptions: { requiresAuth: false } as BaseQueryExtraOptions, // Mark as NOT requiring auth
      }),
      // Use onQueryStarted to handle the side effect (dispatching setAuthData on success)
      async onQueryStarted(credentials, { dispatch, queryFulfilled }) {
        // ... inside login mutation's async onQueryStarted(credentials, { dispatch, queryFulfilled }) { ...
        try {
          const { data } = await queryFulfilled;
          console.log("Login successful, received data structure:", data);

          // --- CORRECTLY EXTRACT TOKENS BASED ON API RESPONSE STRUCTURE ---
          // Assuming login response has tokens nested and camelCase (based on your logs)
          const accessToken = data.tokens.accessToken; // *** FIX: Change from access_token to accessToken ***
          const refreshToken = data.tokens.refreshToken; // *** FIX: Change from refresh_token to refreshToken ***

          // Assuming login response also includes the user data at the top level
          const userData = data.user; // This seems correct based on logs
          // --- End Extraction ---

          if (accessToken && refreshToken && userData) {
            // This should now be true if tokens are extracted
            console.log(
              "Extracted tokens and user data after login, dispatching setAuthData."
            );
            // Dispatch setAuthData with the new tokens and user data
            dispatch(
              setAuthData({
                tokens: {
                  accessToken: accessToken, // camelCase for Redux state
                  refreshToken: refreshToken, // camelCase for Redux state
                },
                user: userData, // userData is User, assignable to User | null | undefined
                isAuthenticated: true, // Set authenticated status
              })
            );
            // The listener middleware will handle saving tokens and user data to storage
          } else {
            console.error(
              "Login successful but token data or user data was missing or unexpected in response."
            );
            dispatch(logout()); // Log out if essential data is missing
          }
        } catch (error) {
          console.error("Login failed in onQueryStarted:", error); // *** Log 4 ***
          // Errors like invalid credentials will typically be handled by the component
          // consuming the useLoginMutation hook (via the error property).
          // Optionally dispatch global notification actions here if needed.
          // Consider dispatching logout on login failure depending on desired UX,
          // but the consuming component usually handles displaying the error message.
          // dispatch(logout()); // Example: force logout on any login query error
        }
      },
    }),
    // Add other endpoints here...
    // Remember to add `extraOptions: { requiresAuth: false } as BaseQueryExtraOptions`
    // for any endpoint that *doesn't* need auth headers (like registration, password reset request, etc.)
  }),
});

// Export typed hooks for use in components
export const { useGetUserQuery, useLoginMutation } = apiSlice;

// --- Cache Clearing on Logout ---
// This part goes in your listener middleware setup (e.g., src/store/auth/authListeners.ts)
/*
import { createListenerMiddleware } from '@reduxjs/toolkit';
import { logout } from './authSlice'; // Your logout action
import { apiSlice } from '../services/apiSlice'; // Your apiSlice

export const apiCacheResetMiddleware = createListenerMiddleware();

apiCacheResetMiddleware.addListener({
  actionCreator: logout,
  effect: async (action, listenerApi) => {
    console.log('Logout action received, resetting API cache.');
    // Dispatch the RTK Query utility to reset the entire apiSlice state
    listenerApi.dispatch(apiSlice.util.resetApiState());
    console.log('RTK Query API state reset.');
  },
});
*/
// Then ensure apiCacheResetMiddleware.middleware is added to your store middleware
