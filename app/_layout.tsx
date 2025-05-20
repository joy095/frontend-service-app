// RootLayout.tsx
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Provider, useSelector, useDispatch } from "react-redux";
import { store, RootState, AppDispatch } from "../src/store/store";
import { hydrateAuthState } from '../src/store/auth/authSlice';
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Inner component handling navigation logic (wrapped by Provider)
function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const dispatch = useDispatch<AppDispatch>();

  // --- Use Redux State for Authentication and Hydration ---
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const isHydrated = useSelector((state: RootState) => state.auth.isHydrated || false);

  console.log(`[RootLayoutNav Render] isAuthenticated: ${isAuthenticated}, isHydrated: ${isHydrated}, segments: ${segments.join('/')}`);

  // Effect to dispatch hydration thunk on mount - this happens only once when component first loads
  useEffect(() => {
    console.log("RootLayoutNav mounted, dispatching hydrateAuthState...");
    dispatch(hydrateAuthState());
  }, [dispatch]);

  // Effect to handle navigation based on auth state
  useEffect(() => {
    console.log(`[Navigation Effect START] isHydrated: ${isHydrated}, isAuthenticated: ${isAuthenticated}, segments: ${segments.join('/')}`);

    // Don't do anything until hydration is complete
    if (!isHydrated) {
      console.log("[Navigation Effect] Waiting for hydration...");
      return;
    }

    const inAuthGroup = segments[0] === "(auth)";
    const inScreensGroup = segments[0] === "(screens)";
    const isOnRoot = segments[0] === undefined; // Check if we're at the root path

    console.log(`[Navigation Effect] Current state: isAuth: ${isAuthenticated}, Hydrated: ${isHydrated}, Segments: ${segments.join('/')}`);
    console.log(`[Navigation Effect] Group Checks: inAuth: ${inAuthGroup}, inScreens: ${inScreensGroup}, isOnRoot: ${isOnRoot}`);


    if (isAuthenticated) {
      // User is authenticated
      if (inAuthGroup || isOnRoot) {
        // Authenticated user is on an auth screen OR the root ('/') page.
        // Redirect them to the main app screens.
        console.log("[Navigation Effect] Authenticated user on auth/root. Redirecting to app...");
        router.replace("/(screens)/profile"); // Redirect to your main app screen
      } else {
        // Authenticated user is already in (screens) or another allowed non-auth route.
        console.log("[Navigation Effect] Authenticated user is in correct app route. No redirect.");
      }
    } else {
      // User is NOT authenticated
      if (inAuthGroup || isOnRoot) {
        // Unauthenticated user is on an auth screen or the root ('/').
        // Allow them to stay here (for login/signup).
        console.log("[Navigation Effect] Unauthenticated user on auth/root. Allowing access.");
      } else if (inScreensGroup) {
        // This is the CRITICAL part for logout:
        // Unauthenticated user is trying to access a protected app screen (e.g., from logout).
        // Redirect them forcibly to the root/login page.
        console.log("[Navigation Effect] Unauthenticated user on protected app screen. Redirecting to root.");
        router.replace("/");
      } else {
        // Catch-all for other unauthenticated access to non-auth/non-root paths.
        // This might include routes that aren't specifically in `(auth)` or `(screens)`.
        // For safety, redirect them to the root.
        console.log("[Navigation Effect] Unauthenticated user on unhandled route. Redirecting to root.");
        router.replace("/");
      }
    }

    console.log("[Navigation Effect END]");
  }, [isAuthenticated, isHydrated, segments, router]);


  // Show loading indicator while hydrating state
  if (!isHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
        <Text>Loading app state...</Text>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "white" },
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(screens)" options={{ headerShown: false }} />
    </Stack>
  );
}

// Top-level layout wrapping with Provider
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <RootLayoutNav />
      </Provider>
    </GestureHandlerRootView>
  );
}