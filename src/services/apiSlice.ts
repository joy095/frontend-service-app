// src/services/apiSlice.ts
import {
  createApi,
  fetchBaseQuery,
  FetchArgs,
  BaseQueryApi,
  FetchBaseQueryError,
  FetchBaseQueryMeta,
} from "@reduxjs/toolkit/query/react";
import { Mutex } from "async-mutex";
import { logout, setAuthData } from "../store/auth/authSlice";
import {
  User,
  GetUserResponse,
  BaseQueryExtraOptions,
  LoginCredentials,
  LoginResponse,
  TokensPayload,
  LoginApiResponseTokens,
  AuthDataPayload,
  CheckUsernameAvailabilityResponse,
  CheckUsernameAvailabilityRequest,
  RegisterResponse,
  RegisterRequest,
} from "../types";
import { BASE_URL } from "@/src/utils/constants";
import type { RootState } from "../store/store";

// Create a new mutex to prevent multiple token refresh attempts at once
const mutex = new Mutex();

// Create a base query instance
const baseQuery = fetchBaseQuery({
  baseUrl: BASE_URL,
  prepareHeaders: (headers, { getState, extra }) => {
    const state = getState() as RootState;
    const accessToken = state.auth.accessToken;
    const typedExtra = extra as BaseQueryExtraOptions | undefined;

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
  api: BaseQueryApi,
  extraOptions: BaseQueryExtraOptions = {}
) => {
  console.log("baseQueryWithReauth CALLED for:", args);

  const typedExtra = extraOptions as BaseQueryExtraOptions;

  // Skip 401 handling for endpoints that explicitly don't require auth
  if (typedExtra?.requiresAuth === false) {
    console.log(
      "baseQueryWithReauth: Skipping auth/refresh logic for unauthenticated endpoint:",
      args
    );
    return baseQuery(args, api, extraOptions);
  }

  // For authenticated endpoints, wait until the mutex is available without locking it
  await mutex.waitForUnlock();
  console.log("baseQueryWithReauth: Mutex unlocked for:", args);

  // Perform the original request
  let result = await baseQuery(args, api, extraOptions);
  console.log(
    "baseQueryWithReauth: Original request result for",
    args,
    ":",
    result
  );

  // Check if the request failed with a 401 error
  const isUnauthorized: boolean =
    !!result.error &&
    !!(
      result.error.status === 401 ||
      (result.error.status === "PARSING_ERROR" &&
        (result.error as any)?.originalStatus === 401)
    );

  console.log(
    "baseQueryWithReauth: Is Unauthorized?",
    isUnauthorized,
    "for",
    args
  );

  if (isUnauthorized) {
    console.log(
      "baseQueryWithReauth: Unauthorized detected, attempting refresh for:",
      args
    );

    const release = await mutex.acquire();
    console.log("baseQueryWithReauth: Mutex acquired for refresh attempt.");

    // Capture the access token that was used in the original failed request
    const originalAccessToken = (api.getState() as RootState).auth.accessToken;
    console.log(
      "baseQueryWithReauth: Original Access Token that failed:",
      originalAccessToken ? "Present" : "Missing"
    );

    let refreshToken: string | null = null;

    try {
      const state = api.getState() as RootState;
      refreshToken = state.auth.refreshToken;

      const stateAfterMutex = api.getState() as RootState;
      const accessTokenAfterMutex = stateAfterMutex.auth.accessToken;

      console.log(
        "baseQueryWithReauth: Refresh Token in state:",
        refreshToken ? "Present" : "Missing"
      );
      console.log(
        "baseQueryWithReauth: Access Token in state (after mutex acquire):",
        accessTokenAfterMutex ? "Present" : "Missing"
      );

      if (
        accessTokenAfterMutex &&
        accessTokenAfterMutex !== originalAccessToken
      ) {
        // Path 1: Token has been updated by another request while waiting for mutex
        console.log(
          "baseQueryWithReauth: Path 1 - Token updated by another request. Retrying original."
        );
        release();
        result = await baseQuery(args, api, extraOptions);
        console.log(
          "baseQueryWithReauth: Result of retried original query (Path 1):",
          result
        );
      } else if (!refreshToken) {
        // Path 2: No refresh token available
        console.error(
          "baseQueryWithReauth: Path 2 - No refresh token found. Logging out."
        );
        api.dispatch(logout());
        // Return the original 401
        result = result;
        console.log(
          "baseQueryWithReauth: Returning original error and logging out (Path 2)."
        );
      } else {
        // Path 3: Proceed with refresh
        console.log(
          "baseQueryWithReauth: Path 3 - Proceeding with token refresh..."
        );

        console.log(
          "baseQueryWithReauth: Path 3 - refreshToken value:",
          refreshToken,
          "Type:",
          typeof refreshToken
        );

        // Make the refresh token request
        const refreshResult = await baseQuery(
          {
            url: "/refresh-token",
            method: "POST",
            body: {},
            headers: {
              "Refresh-Token": refreshToken,
              "Content-Type": "application/json",
            },
            extraOptions: {
              isRefresh: true,
              requiresAuth: false,
            } as BaseQueryExtraOptions,
          } as FetchArgs,
          api,
          {}
        );
        console.log(
          "baseQueryWithReauth: Refresh request result (Path 3):",
          refreshResult
        );

        const refreshResponseData = refreshResult.data as
          | { access_token?: string; refresh_token?: string; user?: User }
          | TokensPayload
          | undefined;

        let newAccessToken: string | null = null;
        let newRefreshToken: string | null = null;
        let newUserData: User | null = null;

        if (
          refreshResponseData &&
          refreshResult.meta?.response?.status === 200
        ) {
          if (
            "accessToken" in refreshResponseData &&
            "refreshToken" in refreshResponseData
          ) {
            newAccessToken = (refreshResponseData as TokensPayload).accessToken;
            newRefreshToken = (refreshResponseData as TokensPayload)
              .refreshToken;
            console.log(
              "baseQueryWithReauth: Extracted tokens from top-level camelCase (ideal refresh response)."
            );
          } else if (
            "access_token" in refreshResponseData &&
            "refresh_token" in refreshResponseData
          ) {
            newAccessToken = (refreshResponseData as any).access_token ?? null;
            newRefreshToken =
              (refreshResponseData as any).refresh_token ?? null;
            newUserData = (refreshResponseData as any).user ?? null;
            console.log(
              "baseQueryWithReauth: Extracted tokens from top-level snake_case (+ user)."
            );
          }

          if (newAccessToken && newRefreshToken) {
            console.log(
              "baseQueryWithReauth: Refresh successful, new tokens extracted."
            );

            const currentStateAfterRefresh = api.getState() as RootState;
            const currentUserDataAtRefresh = currentStateAfterRefresh.auth.user;

            api.dispatch(
              setAuthData({
                tokens: {
                  accessToken: newAccessToken,
                  refreshToken: newRefreshToken,
                },
                user: newUserData ?? currentUserDataAtRefresh,
                isAuthenticated: true,
              })
            );
            console.log(
              "baseQueryWithReauth: Dispatching setAuthData after refresh success."
            );

            console.log(
              "baseQueryWithReauth: Retrying original request:",
              args
            );
            result = await baseQuery(args, api, extraOptions);
            console.log(
              "baseQueryWithReauth: Result of retried original query (Path 3):",
              result
            );
          } else {
            console.error(
              "baseQueryWithReauth: Refresh failed: Status 200 but tokens missing from response body in expected formats.",
              refreshResult.data
            );
            api.dispatch(logout());
            result = refreshResult;
          }
        } else {
          console.error(
            "baseQueryWithReauth: Refresh failed: Status not 200 or no data.",
            refreshResult?.meta?.response?.status,
            refreshResult.data,
            refreshResult.error
          );
          api.dispatch(logout());
          result = refreshResult;
        }
      }
    } finally {
      release();
      console.log("baseQueryWithReauth: Mutex released.");
    }
  }

  return result;
};

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  endpoints: (builder) => ({
    getUser: builder.query<GetUserResponse, string>({
      query: (username) => `/user/${username}`,
      extraOptions: { requiresAuth: true } as BaseQueryExtraOptions,
    }),

    // FIX: Correctly define the logout mutation
    logout: builder.mutation<void, { user_id: string }>({
      query: ({ user_id }) => {
        console.log("apiSlice: logout mutation query function called.");

        return {
          url: "/logout",
          method: "POST",
          body: { user_id }, // Send user_id in body
          extraOptions: { requiresAuth: true } as BaseQueryExtraOptions,
        };
      },
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        console.log("apiSlice: logout mutation onQueryStarted called.");
        try {
          console.log(
            "apiSlice: Waiting for logout mutation queryFulfilled..."
          );
          await queryFulfilled;
          console.log(
            "apiSlice: Backend logout successful. Dispatching logout."
          );
          dispatch(logout());
        } catch (error) {
          console.error("apiSlice: Logout failed:", error);
          dispatch(logout());
        }
      },
    }),

    checkUsernameAvailability: builder.query<CheckUsernameAvailabilityResponse, CheckUsernameAvailabilityRequest>({
      query: (body) => ({
        url: "/username-availability",
        method: "POST",
        body: body,
      }),
    }),

    register: builder.mutation<RegisterResponse, RegisterRequest>({
      query: (body) => ({
        url: "/register",
        method: "POST",
        body: body,
      }),
    }),

    login: builder.mutation<LoginResponse, LoginCredentials>({
      query: (credentials) => ({
        url: "/login",
        method: "POST",
        body: credentials,
        extraOptions: { requiresAuth: false } as BaseQueryExtraOptions,
      }),
      async onQueryStarted(credentials, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          console.log("Login successful, received data structure:", data);

          const accessToken = data.tokens.accessToken;
          const refreshToken = data.tokens.refreshToken;
          const userData = data.user;

          if (accessToken && refreshToken && userData) {
            console.log(
              "Extracted tokens and user data after login, dispatching setAuthData."
            );
            dispatch(
              setAuthData({
                tokens: {
                  accessToken: accessToken,
                  refreshToken: refreshToken,
                },
                user: userData,
                isAuthenticated: true,
              })
            );
          } else {
            console.error(
              "Login successful but token data or user data was missing or unexpected in response."
            );
            dispatch(logout());
          }
        } catch (error) {
          console.error("Login failed in onQueryStarted:", error);
        }
      },
    }),


  }),
});

// Export typed hooks for use in components
export const { useGetUserQuery, useLoginMutation, useLogoutMutation, useCheckUsernameAvailabilityQuery, useRegisterMutation } = apiSlice;
