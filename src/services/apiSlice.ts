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
import {
  logout,
  setAuthData,
  setRegisteredUser,
} from "../store/auth/authSlice";
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
  RegisteredUser,
  VerifyOtpResponse,
  VerifyOtpRequest,
} from "../types";
import { BASE_URL } from "@/src/utils/constants";
import type { RootState } from "../store/store";
import AsyncStorage from "@react-native-async-storage/async-storage";

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


      // Check if the token is still the same one that failed or if it was updated
      if (
        accessTokenAfterMutex &&
        accessTokenAfterMutex !== originalAccessToken
      ) {
        // Path 1: Token has been updated by another request while waiting for mutex
        console.log(
          "baseQueryWithReauth: Path 1 - Token updated by another request. Retrying original."
        );
        release(); // Release the mutex immediately as we are not doing a refresh
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
        // Return the original 401 error result
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
          {} // No extra options needed for the refresh request itself
        );
        console.log(
          "baseQueryWithReauth: Refresh request result (Path 3):",
          refreshResult
        );

        // Assuming refresh token response contains new access and refresh tokens
        // Adjust data extraction based on your actual refresh endpoint response structure
        const refreshResponseData = refreshResult.data as
          | { access_token?: string; refresh_token?: string; user?: User }
          | TokensPayload
          | undefined;

        let newAccessToken: string | null = null;
        let newRefreshToken: string | null = null;
        let newUserData: User | null = null;


        // Check for successful refresh response data structure
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
            newUserData = (refreshResponseData as any).user ?? null; // Capture user if returned
            console.log(
              "baseQueryWithReauth: Extracted tokens from top-level snake_case (+ user)."
            );
          }

          if (newAccessToken && newRefreshToken) {
            console.log(
              "baseQueryWithReauth: Refresh successful, new tokens extracted."
            );

            // Get the current user data from the state *before* dispatching setAuthData
            const currentStateAfterRefresh = api.getState() as RootState;
            const currentUserDataAtRefresh = currentStateAfterRefresh.auth.user;


            // Dispatch action to update tokens and user data in Redux state and storage
            api.dispatch(
              setAuthData({
                tokens: {
                  accessToken: newAccessToken,
                  refreshToken: newRefreshToken,
                },
                user: newUserData ?? currentUserDataAtRefresh, // Use new user data if provided, otherwise keep current
                isAuthenticated: true, // User is now authenticated with new tokens
              })
            );
            console.log(
              "baseQueryWithReauth: Dispatching setAuthData after refresh success."
            );

            // Retry the original request with the new tokens
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
            // Refresh succeeded (status 200) but tokens were not in the expected format
            console.error(
              "baseQueryWithReauth: Refresh failed: Status 200 but tokens missing from response body in expected formats.",
              refreshResult.data
            );
            api.dispatch(logout()); // Log out user as we can't get new tokens
            result = refreshResult; // Return the refresh error result
          }
        } else {
          // Refresh request failed (non-200 status or no data)
          console.error(
            "baseQueryWithReauth: Refresh failed: Status not 200 or no data.",
            refreshResult?.meta?.response?.status,
            refreshResult.data,
            refreshResult.error
          );
          api.dispatch(logout()); // Log out user as refresh failed
          result = refreshResult; // Return the refresh error result
        }
      }
    } finally {
      // Ensure mutex is released
      release();
      console.log("baseQueryWithReauth: Mutex released.");
    }
  }

  // Return the result of the original request (either successful or the retried one)
  // or the error result if refresh failed or no refresh token was available
  return result;
};


export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth, // Use the custom base query with reauthentication
  endpoints: (builder) => ({
    // Example Query: Fetch user data
    // Assumes your backend has an endpoint like GET /user/:username
    getUser: builder.query<GetUserResponse, string | undefined>({ // Allow undefined for the initial fetch
      query: (username) => {
        // You might need to get the username from the state if not passed as argument
        // This depends on how your getUser endpoint is designed.
        // If getUser doesn't need a username and just uses the token, query: () => '/user'
        return username ? `/user/${username}` : '/user'; // Example: either by username or just /user
      },
      extraOptions: { requiresAuth: true } as BaseQueryExtraOptions, // This endpoint requires authentication
      transformResponse: (response: GetUserResponse) => {
        // Optional: Transform the response if needed, e.g., flatten nested objects
        return response;
      },
    }),

    // FIX: Correctly define the logout mutation
    logout: builder.mutation<void, { user_id: string }>({
      query: ({ user_id }) => {
        console.log("apiSlice: logout mutation query function called.");

        return {
          url: "/logout", // Your backend logout endpoint
          method: "POST",
          body: { user_id }, // Send user_id in body
          extraOptions: { requiresAuth: true } as BaseQueryExtraOptions, // Requires authentication to log out
        };
      },
      // Execute side effects after the mutation is completed (either success or failure)
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        console.log("apiSlice: logout mutation onQueryStarted called.");
        try {
          console.log(
            "apiSlice: Waiting for logout mutation queryFulfilled..."
          );
          // Wait for the backend logout call to complete (or fail)
          await queryFulfilled;
          console.log(
            "apiSlice: Backend logout successful or completed. Dispatching logout."
          );
          // Regardless of backend success/failure at this point, clear frontend state
          dispatch(logout());
        } catch (error) {
          console.error("apiSlice: Logout failed (backend response error):", error);
          // Even if the backend logout failed, we should usually clear the client state
          // to avoid inconsistencies.
          dispatch(logout());
        }
      },
    }),

    checkUsernameAvailability: builder.query<
      CheckUsernameAvailabilityResponse,
      CheckUsernameAvailabilityRequest
    >({
      query: (body) => ({
        url: "/username-availability", // Your backend endpoint
        method: "POST",
        body: body,
      }),
      extraOptions: { requiresAuth: false } as BaseQueryExtraOptions, // Does not require auth
    }),

    register: builder.mutation<RegisterResponse, RegisterRequest>({
      query: (body) => ({
        url: "/register", // Your backend registration endpoint
        method: "POST",
        body: body,
        extraOptions: { requiresAuth: false } as BaseQueryExtraOptions, // Does not require auth
      }),
      // Handle side effects after registration is successful
      async onQueryStarted(credentials, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled; // data is of type RegisterResponse
          console.log(
            "Registration successful, received user data structure:",
            data
          );

          // Assuming the RegisterResponse structure is the RegisteredUser structure
          const registeredUserData: RegisteredUser = data;

          // Check if necessary registered user data is present
          if (registeredUserData && registeredUserData.id) {
            console.log(
              "Extracted registered user data. User is registered but not yet authenticated/verified."
            );

            // --- MODIFY TO SAVE DATA + TIMESTAMP ---
            // Wrap the user data with a timestamp for expiration
            const dataToStore = {
              data: registeredUserData,
              timestamp: Date.now(), // Save the current timestamp in milliseconds
            };
            try {
              await AsyncStorage.setItem(
                "registeredUserData",
                JSON.stringify(dataToStore)
              );
              console.log(
                "Registered user data with timestamp saved to AsyncStorage."
              );
            } catch (lsError) {
              console.error(
                "Failed to save registered user data to AsyncStorage:",
                lsError
              );
            }
            // ------------------------------------

            // Dispatch the action to set the registered user state in Redux
            dispatch(
              setRegisteredUser({ user: registeredUserData, isRegistered: true })
            );
            console.log("Registered user state set in Redux.");

          } else {
            console.error(
              "Registration successful but user data was missing or unexpected in response."
            );
            // Optionally handle this case, e.g., show an error message to the user
          }
        } catch (error) {
          console.error("Registration failed in onQueryStarted:", error);
          // Handle registration failure (e.g., show error message from error payload)
        }
      },
    }),

    verifyOtp: builder.mutation<VerifyOtpResponse, VerifyOtpRequest>({
      query: (body) => ({
        url: "/verify-otp", // Your backend verify OTP endpoint
        method: "POST",
        body: body,
        extraOptions: { requiresAuth: false } as BaseQueryExtraOptions, // Does not require auth (initial verification)
      }),
      // Handle side effects after OTP verification is successful
      async onQueryStarted(credentials, { dispatch, queryFulfilled }) {
        try {
          // --- STEP 1: Receive Tokens from OTP Verification ---
          const { data: tokens } = await queryFulfilled; // Get tokens from the response
          console.log("OTP verification successful. Received tokens.");
          // Tokens are now in `tokens` (VerifyOtpResponse type)

          // --- STEP 2: Fetch User Data using the new tokens ---
          // Dispatch a query to fetch the user's full data using the *newly acquired* token.
          // The baseQueryWithReauth will automatically use the token that
          // will be saved by the subsequent `setAuthData` dispatch.
          // We forceRefetch to ensure it doesn't use cached data from a non-authenticated state.
          // Assuming getUser doesn't require a specific username argument if token is present,
          // or you might need to get the username from the credentials if your getUser endpoint needs it.
          const userResult = await dispatch(
            // If getUser needs username from credentials:
            // apiSlice.endpoints.getUser.initiate(credentials.username, { // Assuming username is in credentials
            // If getUser only needs token:
            apiSlice.endpoints.getUser.initiate(undefined, { // Or initiate() if no args needed
              forceRefetch: true // Ensure fresh data
            })
          );

          // --- STEP 3: Dispatch setAuthData with Tokens and User Data ---
          // Check if fetching user data was successful
          if (userResult.isSuccess && userResult.data) {
            // Assuming getUserResponse is { user: UserData }
            // Extract the actual User object from the nested response structure
            const userData: User = userResult.data.user;
            console.log("Fetched authenticated user data.");


            // Dispatch the action to set tokens & user data in Redux state and AsyncStorage
            dispatch(
              setAuthData({
                tokens: {
                  accessToken: tokens.accessToken,
                  refreshToken: tokens.refreshToken,
                },
                user: userData,
                isAuthenticated: true, // User is now fully authenticated
              })
            );
            console.log("Authenticated state set via setAuthData.");

            // --- Optional: Clear the registered user state from Redux state ---
            // setAuthData reducer already clears registered state/storage, but explicit
            // dispatch here can sometimes make component reactions clearer.
            dispatch(setRegisteredUser({ user: null, isRegistered: false }));
            console.log("Cleared registered user state.");

          } else {
            // Handle the case where OTP verification succeeded (got tokens),
            // but fetching the user profile failed.
            console.error(
              "Failed to fetch user data after OTP verification:",
              userResult.error
            );
            // You might still want to save tokens (as the user is technically logged in)
            // but indicate that profile data couldn't be loaded.
            dispatch(
              setAuthData({
                tokens: {
                  accessToken: tokens.accessToken,
                  refreshToken: tokens.refreshToken,
                },
                user: null, // User data is null as fetching failed
                isAuthenticated: true, // User has tokens, considered authenticated
              })
            );
            console.log("Authenticated state set with tokens but no user data.");

            // Optionally, show an alert to the user that profile data could not be loaded
            // Consider a mechanism to retry fetching user data later.
          }
        } catch (error) {
          console.error("OTP verification failed in onQueryStarted:", error);
          // Handle OTP verification failure (e.g., show error message from error payload)
          // On failure, ensure no partial auth state remains
          dispatch(logout()); // Clear any partial state like tokens
          console.log("OTP verification failed, dispatched logout.");
        }
      },
    }),

    login: builder.mutation<LoginResponse, LoginCredentials>({
      query: (credentials) => ({
        url: "/login", // Your backend login endpoint
        method: "POST",
        body: credentials,
        extraOptions: { requiresAuth: false } as BaseQueryExtraOptions, // Does not require auth
      }),
      // Handle side effects after login is successful
      async onQueryStarted(credentials, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled; // data is of type LoginResponse
          console.log("Login successful, received data structure:", data);

          // Assuming LoginResponse has nested 'tokens' and top-level 'user'
          const accessToken = data.tokens.accessToken;
          const refreshToken = data.tokens.refreshToken;
          const userData = data.user; // Assuming user data is directly in the response

          // Check if necessary data is present in the response
          if (accessToken && refreshToken && userData) {
            console.log(
              "Extracted tokens and user data after login, dispatching setAuthData."
            );
            // Dispatch the action to set tokens & user data in Redux state and AsyncStorage
            dispatch(
              setAuthData({
                tokens: {
                  accessToken: accessToken,
                  refreshToken: refreshToken,
                },
                user: userData,
                isAuthenticated: true, // User is now fully authenticated
              })
            );
            console.log("Authenticated state set via setAuthData.");

            // Clear any registered user state if login is successful
            // dispatch(setRegisteredUser({ user: null, isRegistered: false }));
            // console.log("Cleared registered user state after successful login.");

          } else {
            console.error(
              "Login successful but token data or user data was missing or unexpected in response."
            );
            // If the response structure is unexpected but status is 200,
            // it's safer to treat as a failure and log out any potentially
            // lingering state.
            dispatch(logout());
            console.log("Login response missing data, dispatched logout.");
            // Optionally, show a generic login error message to the user
          }
        } catch (error) {
          console.error("Login failed in onQueryStarted:", error);
          // Handle login failure (e.g., show error message from error payload)
          // Ensure no partial auth state remains on login failure
          dispatch(logout()); // Clear any partial state
          console.log("Login failed, dispatched logout.");
        }
      },
    }),
  }),
});

// Export typed hooks for use in components
export const {
  useGetUserQuery,
  useLoginMutation,
  useLogoutMutation,
  useCheckUsernameAvailabilityQuery,
  useRegisterMutation,
  useVerifyOtpMutation
} = apiSlice;