// src/store/auth/authSlice.ts
import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthState, User, AuthDataPayload, RegisteredUser } from "../../types"; // Import types

// Expiration time for registered user data in AsyncStorage (e.g., 7 days)
// 1000ms * 60s * 60min * 24h * 7 days
const REGISTERED_DATA_EXPIRATION_MS = 1000 * 60 * 60 * 24 * 7;

// Async Thunk to load authentication state from storage when the app starts
export const hydrateAuthState = createAsyncThunk(
  "auth/hydrateAuthState",
  async (_, { dispatch }) => {
    try {
      // Attempt to load authenticated user data
      const storedAccessToken = await AsyncStorage.getItem("accessToken");
      const storedRefreshToken = await AsyncStorage.getItem("refreshToken");
      const storedUserJson = await AsyncStorage.getItem("user");

      // Attempt to load registered user data
      const storedRegisteredUserJson = await AsyncStorage.getItem("registeredUserData");

      if (storedAccessToken && storedRefreshToken && storedUserJson) {
        // --- CASE 1: Authenticated data exists ---
        console.log("Auth state hydrated from storage (Authenticated).");
        try {
          const storedUser: User = JSON.parse(storedUserJson);
          // Dispatch action to set the authenticated state
          dispatch(
            setAuthData({
              tokens: { accessToken: storedAccessToken, refreshToken: storedRefreshToken },
              user: storedUser,
              isAuthenticated: true,
            })
          );
          // If authenticated, ensure any lingering registered data is removed
          await AsyncStorage.removeItem('registeredUserData').catch(err => console.error("Failed to clear registeredUserData on hydrate (authenticated):", err));
          console.log("Cleared any lingering registeredUserData after hydrating authenticated state.");

        } catch (parseError) {
          console.error("Failed to parse stored authenticated user data:", parseError);
          // If parsing fails, treat as invalid data and clear storage
          await AsyncStorage.multiRemove(["accessToken", "refreshToken", "user"])
            .catch(err => console.error("Failed to clear corrupted auth data:", err));
          // Fall through to check registered data or end up in default state
        }


      } else if (storedRegisteredUserJson) {
        // --- CASE 2: No authenticated data, but registered data might exist ---
        console.log("No authenticated data found, checking for registered data.");
        try {
          const storedRegisteredObject = JSON.parse(storedRegisteredUserJson);

          // --- Check for expiration ---
          if (storedRegisteredObject && storedRegisteredObject.data && storedRegisteredObject.timestamp) {
            const now = Date.now();
            const savedTimestamp = storedRegisteredObject.timestamp;
            const isExpired = (now - savedTimestamp) > REGISTERED_DATA_EXPIRATION_MS;

            if (!isExpired) {
              // Data is valid and not expired
              console.log("Registered state hydrated from storage (Not Authenticated, Valid Registered Data).");
              const storedRegisteredUser: RegisteredUser = storedRegisteredObject.data;
              dispatch(setRegisteredUser({ user: storedRegisteredUser, isRegistered: true }));
              console.log("Set registered user state from storage.");
            } else {
              // Data is expired - remove it
              console.log("Registered user data in storage is expired. Removing it.");
              await AsyncStorage.removeItem('registeredUserData').catch(err => console.error("Failed to clear expired registeredUserData:", err));
              // No state update needed, effectively treated as no registered data found
            }
          } else {
            // Data exists but is in an unexpected format (corrupted?) - remove it
            console.error("Registered user data in storage is corrupted or incomplete. Removing it.");
            await AsyncStorage.removeItem('registeredUserData').catch(err => console.error("Failed to clear corrupted registeredUserData:", err));
          }

        } catch (e) {
          // Failed to parse JSON - registered data is corrupted - remove it
          console.error("Failed to parse registered user data from storage:", e);
          await AsyncStorage.removeItem('registeredUserData').catch(err => console.error("Failed to clear corrupted registeredUserData:", err));
        }
      }
      else {
        // --- CASE 3: No auth or registered data found ---
        console.log("No auth or registered data found in storage.");
        // Ensure no residual registered data if somehow missed above
        await AsyncStorage.removeItem('registeredUserData').catch(err => console.error("Failed to clear registeredUserData (no data found):", err));
      }
    } catch (error) {
      console.error("Failed to hydrate auth state from storage:", error);
      // If hydration process itself fails unexpectedly
    } finally {
      // Always dispatch an action to mark hydration as complete, regardless of success
      dispatch(setHydrated());
      console.log("Auth state hydration marked as complete.");
    }
  }
);


// Define the expected payload for setRegisteredUser
interface SetRegisteredUserPayload {
  user: RegisteredUser | null; // User can be null when clearing
  isRegistered: boolean; // Can be true or false
}

// Define the initial state for the auth slice
const initialState: AuthState = {
  accessToken: null,
  refreshToken: null,
  user: null, // Holds authenticated user data
  isAuthenticated: false,
  isHydrated: false, // Flag to indicate if hydration from storage is complete
  registeredUser: null, // Holds data for user who just registered (before verification)
  isRegistered: false, // Flag for registered but not yet authenticated
};

// Create the auth slice using createSlice
const authSlice = createSlice({
  name: "auth",
  initialState, // Pass the defined initial state
  reducers: {
    // Reducer to set authenticated user data and tokens
    setAuthData: (state, action: PayloadAction<AuthDataPayload>) => {
      state.accessToken = action.payload.tokens.accessToken;
      state.refreshToken = action.payload.tokens.refreshToken;
      state.user = action.payload.user || null; // Ensure user is null if not provided
      state.isAuthenticated = true; // Mark as authenticated

      // Clear any registered state when setting authenticated state
      state.registeredUser = null;
      state.isRegistered = false;
      console.log("authSlice: setAuthData - Clearing registered user state.");


      // Persistence logic here using AsyncStorage.setItem for authenticated data
      // Note: These are async operations but reducers must be synchronous.
      // Redux Toolkit handles this by allowing async logic in thunks or onQueryStarted.
      // These `setItem` calls here are technically side effects within a reducer,
      // which is generally discouraged. It's better practice to handle this
      // in the `onQueryStarted` or a thunk that dispatches this reducer.
      // However, this pattern is common for simple persistence with Redux Toolkit.
      AsyncStorage.setItem(
        "accessToken",
        action.payload.tokens.accessToken
      ).catch((err) => console.error("Failed to save access token:", err));
      AsyncStorage.setItem(
        "refreshToken",
        action.payload.tokens.refreshToken
      ).catch((err) => console.error("Failed to save refresh token:", err));
      AsyncStorage.setItem("user", JSON.stringify(action.payload.user)).catch(
        (err) => console.error("Failed to save user:", err)
      );

      // Also clear the registered user data from storage once authenticated data is set
      AsyncStorage.removeItem('registeredUserData').catch(err => console.error("Failed to clear registeredUserData:", err));
      console.log("authSlice: setAuthData - Removed registeredUserData from storage.");

    },

    // Reducer to set data for a user who has just registered but is not yet verified/authenticated
    setRegisteredUser: (state, action: PayloadAction<SetRegisteredUserPayload>) => {
      state.registeredUser = action.payload.user; // Can be null when clearing
      state.isRegistered = action.payload.isRegistered; // Can be true or false

      // Ensure authenticated state is false when setting registered state
      state.isAuthenticated = false;
      state.accessToken = null;
      state.refreshToken = null;
      state.user = null;

      // AsyncStorage saving for registeredUser with timestamp
      // This saving typically happens in the API slice's onQueryStarted for the register mutation
      // to include the timestamp and handle the API response directly.
      // No need to save here again if handled in onQueryStarted.
      console.log("authSlice: setRegisteredUser - State updated.");
    },

    // Reducer to clear all authentication and registered user data
    logout: (state) => {
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.user = null;
      state.registeredUser = null; // Clear registered user state on logout
      state.isRegistered = false; // Clear registered flag on logout
      // isHydrated remains true after initial load

      // Clear persistence here for both authenticated and potentially registered data
      // Again, these are async operations within a sync reducer. Better handled in a thunk
      // that dispatches logout or in the onQueryStarted of the logout mutation.
      AsyncStorage.removeItem("accessToken").catch((err) =>
        console.error("Failed to remove access token:", err)
      );
      AsyncStorage.removeItem("refreshToken").catch((err) =>
        console.error("Failed to remove refresh token:", err)
      );
      AsyncStorage.removeItem("user").catch((err) =>
        console.error("Failed to remove user:", err)
      );
      // Also clear registered data on logout
      AsyncStorage.removeItem("registeredUserData").catch((err) =>
        console.error("Failed to remove registeredUserData:", err)
      );
      console.log("authSlice: logout - State and storage cleared.");
    },

    // Reducer to mark the hydration process as complete
    setHydrated: (state) => {
      state.isHydrated = true;
      console.log("authSlice: Hydration marked as complete.");
    },
  },
});

// Export the action creators generated by createSlice
export const { setAuthData, logout, setHydrated, setRegisteredUser } = authSlice.actions;

// Export the reducer function
export default authSlice.reducer;