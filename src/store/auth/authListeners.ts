// src/store/auth/authListeners.ts
import {
  createListenerMiddleware,
  // *** FIX: Remove problematic ListenerMiddlewareAPI imports ***
  // type ListenerMiddlewareAPI, // Remove this line
  // import type { ListenerMiddlewareAPI } from '@reduxjs/toolkit/dist/listenerMiddleware/types'; // Remove or comment out this line
  type TypedStartListening, // Import the type for startListening
  type PayloadAction, // Import PayloadAction for action typing
} from "@reduxjs/toolkit";

// *** FIX: Remove manual ThunkDispatch import and definition here ***
// import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit'; // REMOVE THIS
import { setAuthData, logout } from "./authSlice"; // Import your auth actions
import { saveTokens, deleteTokens } from "../../utils/tokenStorage"; // Import your secure storage utility
import { apiSlice } from "../../services/apiSlice"; // Import your apiSlice to access its utility
// *** FIX: Import RootState and AppDispatch from your store configuration file ***
import type { RootState, AppDispatch } from "../store"; // Import RootState and AppDispatch types
import type { AuthDataPayload } from "@/src/types"; // Import AuthDataPayload type (ensure path is correct)

// *** FIX: Remove manual AppDispatch definition here ***
// export type AppDispatch = ThunkDispatch<RootState, UnknownAction, unknown>; // REMOVE THIS

// Create the main authentication listener middleware instance
// *** FIX: Ensure type parameters are correctly applied to createListenerMiddleware ***
// The implicit 'any' on authMiddleware should resolve if RootState and AppDispatch
// are correctly resolved and the problematic ListenerMiddlewareAPI import is removed.
export const authMiddleware = createListenerMiddleware<
  RootState,
  AppDispatch
>();

// Define typed versions of startListening for convenience and better type inference
// *** FIX: Define AppStartListening based on the middleware instance itself ***
export type AppStartListening = TypedStartListening<RootState, AppDispatch>;

// Cast the middleware's startListening method to our typed version
const startAppListening = authMiddleware.startListening as AppStartListening;

// Add listeners to the middleware instance using startAppListening
// Listener for setAuthData: Save tokens to secure storage
startAppListening({
  // *** FIX: Use startListening method on the middleware instance ***
  actionCreator: setAuthData,
  effect: async (
    action,
    listenerApi
    // Use _listenerApi if you don't use it within the effect to silence warning
    // _listenerApi
  ) => {
    console.log("Auth Listener: setAuthData received, saving tokens...");
    // action.payload contains the data passed to setAuthData
    // *** FIX: Add type assertion for action.payload to AuthDataPayload ***
    const { tokens } = (action as PayloadAction<AuthDataPayload>).payload;
    if (tokens?.accessToken && tokens?.refreshToken) {
      try {
        await saveTokens(tokens.accessToken, tokens.refreshToken);
        console.log("Auth Listener: Tokens saved successfully.");
      } catch (error) {
        console.error("Auth Listener: Failed to save tokens:", error);
        // Decide how to handle storage failure - e.g., dispatch logout if critical
        // listenerApi.dispatch(logout()); // Example using listenerApi (now typed correctly)
      }
    } else {
      console.warn(
        "Auth Listener: setAuthData payload missing tokens, skipping save."
      );
    }
  },
});

// Listener for logout: Delete tokens from secure storage AND reset API cache
startAppListening({
  // *** FIX: Use startListening method on the middleware instance ***
  actionCreator: logout,
  effect: async (
    // *** FIX: Use Parameters to infer action and listenerApi types from AppStartListening ***
    action: Parameters<AppStartListening>[0]["effect"] extends (
      action: infer A,
      ...rest: any[]
    ) => any
      ? A
      : any,
    listenerApi: Parameters<AppStartListening>[0]["effect"] extends (
      action: any,
      listenerApi: infer L,
      ...rest: any[]
    ) => any
      ? L
      : any
  ) => {
    console.log(
      "Auth Listener: logout received, deleting tokens and resetting API cache..."
    );
    // *** FIX: Add type assertion for action to PayloadAction<void> ***
    action as PayloadAction<void>; // Assert action type if needed, though logout has no payload

    try {
      await deleteTokens(); // Delete tokens from secure storage
      console.log("Auth Listener: Tokens deleted successfully.");
    } catch (error) {
      console.error("Auth Listener: Failed to delete tokens:", error);
      // Handle storage deletion failure
    }

    // *** Dispatch the RTK Query utility to reset the entire apiSlice state ***
    // This clears all cached data from RTK Query endpoints
    listenerApi.dispatch(apiSlice.util.resetApiState()); // Dispatch method is available on listenerApi
    console.log("Auth Listener: RTK Query API state reset.");

    // You might also trigger navigation to the login screen here if not handled by your RootLayout
    // Make sure navigation is added to the middleware extra if you use it here
    // (listenerApi.extra as { navigation: any }).navigation.navigate('Login'); // Example using extra
  },
});

// You can add other listeners here for other auth-related side effects

// Note: This setup assumes you'll add authMiddleware.middleware to your store configuration.
// Ensure you are adding authMiddleware.middleware and NOT calling addListener directly in store setup.
// If you continue to get TypeScript errors, ensure your RootState and AppDispatch types
// are correctly defined in your store.ts and imported here.
