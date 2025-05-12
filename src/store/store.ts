// src/store/store.ts
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./auth/authSlice"; // Adjust path if needed
import { apiSlice } from "../services/apiSlice"; // Adjust path if needed
import { authMiddleware } from "./auth/authListeners"; // Import your auth listener middleware


// Configure the Redux store
export const store = configureStore({
  reducer: {
    // Add your reducers here
    auth: authReducer, // Your authentication slice reducer
    [apiSlice.reducerPath]: apiSlice.reducer, // The reducer for your RTK Query API slice
    // Add other reducers for your application state
  },
  // Add middleware to the store setup
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Optional: Configure specific middleware options if needed
      // serializableCheck: {
      //   ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      // },
      // Optional: Pass extra arguments to middleware (like navigation if needed in effects)
      // thunk: {
      //   extraArgument: {
      //     navigation: navigation, // Only if you pass navigation from a component
      //   },
      // },
    }).concat(
      // Add your custom middleware here
      apiSlice.middleware, // The RTK Query API middleware for handling requests and caching
      authMiddleware.middleware // Your custom authentication listener middleware
      // Add other middleware instances
    ),
  // Enable Redux DevTools extension in development mode
  devTools: process.env.NODE_ENV !== "production",
});

// Infer the `RootState` and `AppDispatch` types from the store itself
// This is the standard and recommended way to define these types in RTK
// Removing the incorrect hook call should allow TypeScript to infer these types correctly.
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: { auth: AuthState, api: ApiState, ... }

export type AppDispatch = typeof store.dispatch;
// Inferred type: ThunkDispatch | AnyAction | etc.
