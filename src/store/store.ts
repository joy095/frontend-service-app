// src/store/store.ts
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./auth/authSlice"; // Adjust path if needed
import { apiSlice } from "../services/apiSlice"; // Adjust path if needed
import { authMiddleware } from "./auth/authListeners";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      apiSlice.middleware,
      authMiddleware.middleware
    ), // Add authMiddleware here
  devTools: process.env.NODE_ENV !== "production", // Enable devtools
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: { auth: AuthState, api: ApiState }
export type AppDispatch = typeof store.dispatch;
