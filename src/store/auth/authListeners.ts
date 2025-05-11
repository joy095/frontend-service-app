// src/store/auth/authListeners.ts
import { createListenerMiddleware, addListener } from "@reduxjs/toolkit";
import { setAuthData, logout } from "./authSlice"; // Import your auth actions
import { saveTokens, deleteTokens } from "../../utils/tokenStorage"; // Import your secure storage utility

export const authMiddleware = createListenerMiddleware();

// Listener for setAuthData: Save tokens to secure storage
addListener({
  actionCreator: setAuthData,
  effect: async (action, listenerApi) => {
    console.log("Auth Listener: setAuthData received, saving tokens...");
    // action.payload contains the data passed to setAuthData
    const { tokens } = action.payload;
    if (tokens?.accessToken && tokens?.refreshToken) {
      try {
        await saveTokens(tokens.accessToken, tokens.refreshToken);
        console.log("Auth Listener: Tokens saved successfully.");
      } catch (error) {
        console.error("Auth Listener: Failed to save tokens:", error);
        // Handle storage failure if necessary (e.g., dispatch logout if critical)
        // listenerApi.dispatch(logout());
      }
    } else {
      console.warn(
        "Auth Listener: setAuthData payload missing tokens, skipping save."
      );
    }
  },
});

// Listener for logout: Delete tokens from secure storage
addListener({
  actionCreator: logout,
  effect: async (action, listenerApi) => {
    console.log("Auth Listener: logout received, deleting tokens...");
    try {
      await deleteTokens();
      console.log("Auth Listener: Tokens deleted successfully.");
    } catch (error) {
      console.error("Auth Listener: Failed to delete tokens:", error);
      // Handle storage deletion failure if necessary
    }
  },
});

// You can add other listeners here for other auth-related side effects
