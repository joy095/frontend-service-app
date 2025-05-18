// src/store/authSlice.ts
import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthState, User, AuthDataPayload, RegisterResponse } from "../../types"; // Import types

// Async Thunk to load state from storage
export const hydrateAuthState = createAsyncThunk(
  "auth/hydrateAuthState",
  async (_, { dispatch }) => {
    try {
      const storedAccessToken = await AsyncStorage.getItem("accessToken");
      const storedRefreshToken = await AsyncStorage.getItem("refreshToken");
      const storedUserJson = await AsyncStorage.getItem("user");

      if (storedAccessToken && storedRefreshToken && storedUserJson) {
        const storedUser: User = JSON.parse(storedUserJson); // Parse JSON back to User object
        // Dispatch setAuthData to populate state from storage
        dispatch(
          setAuthData({
            tokens: {
              accessToken: storedAccessToken,
              refreshToken: storedRefreshToken,
            },
            user: storedUser,
            isAuthenticated: true,
          })
        );
        console.log("Auth state hydrated from storage.");
      } else {
        console.log("No auth data found in storage.");
      }
    } catch (error) {
      console.error("Failed to hydrate auth state from storage:", error);
      // Handle errors (e.g., corrupted storage data) - maybe dispatch logout or set initial state
    } finally {
      // Always dispatch an action to mark hydration as complete
      dispatch(setHydrated()); // Dispatch the new action
    }
  }
);


interface SetRegisteredUserPayload {
  user: RegisterResponse; // Use the type that matches your registration response
  isRegistered: true; // Add a flag to indicate registration
  // No tokens or isAuthenticated here yet
}

const initialState: AuthState = {
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  isHydrated: false,
  registeredUser: null, // Initialize new state properties
  isRegistered: false, // Initialize new state properties
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuthData: (state, action: PayloadAction<AuthDataPayload>) => {
      state.accessToken = action.payload.tokens.accessToken;
      state.refreshToken = action.payload.tokens.refreshToken;
      state.user = action.payload.user || null;
      state.isAuthenticated = true;
      // Don't set isHydrated here unless it's part of hydration specific logic
      // state.isHydrated = true; // <-- NO, handle hydration state separately

      // Persistence logic here (using AsyncStorage.setItem)
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
    },

    setRegisteredUser: (state, action: PayloadAction<SetRegisteredUserPayload>) => {
      // *** FIX: Assign to registeredUser state property ***
      state.registeredUser = action.payload.user;
      // *** FIX: Set the isRegistered flag which now exists in AuthState ***
      state.isRegistered = true;

      // Crucially, isAuthenticated remains false
      state.isAuthenticated = false;
      // Clear any previous authenticated state
      state.accessToken = null;
      state.refreshToken = null;
      state.user = null;

      // Optional: Persist the registered user state if needed across app restarts before verification
      // AsyncStorage.setItem("registeredUser", JSON.stringify(action.payload.user)).catch(
      //     (err) => console.error("Failed to save registered user:", err)
      // );
      // AsyncStorage.removeItem("accessToken").catch((err) => console.error("Failed to remove access token from storage:", err));
      // AsyncStorage.removeItem("refreshToken").catch((err) => console.error("Failed to remove refresh token from storage:", err));
      // AsyncStorage.removeItem("user").catch((err) => console.error("Failed to remove authenticated user from storage:", err));
    },

    logout: (state) => {
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.user = null;
      // isHydrated remains true after initial load

      // Clear persistence here
      AsyncStorage.removeItem("accessToken").catch((err) =>
        console.error("Failed to remove access token:", err)
      );
      AsyncStorage.removeItem("refreshToken").catch((err) =>
        console.error("Failed to remove refresh token:", err)
      );
      AsyncStorage.removeItem("user").catch((err) =>
        console.error("Failed to remove user:", err)
      );
    },
    // New reducer to set hydration status
    setHydrated: (state) => {
      state.isHydrated = true;
      console.log("Auth state hydration marked as complete.");
    },
  },
});



export const { setAuthData, logout, setHydrated, setRegisteredUser } = authSlice.actions; // Export the new action

export default authSlice.reducer;
