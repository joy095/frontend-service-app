// RootLayout.tsx
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Provider, useSelector, useDispatch } from "react-redux"; // Import useDispatch
import { store, RootState, AppDispatch } from "../src/store/store"; // Import store, RootState, AppDispatch
import { hydrateAuthState } from '../src/store/authSlice'; // Import the async thunk

// Inner component handling navigation logic (wrapped by Provider)
function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const dispatch = useDispatch<AppDispatch>(); // Get the dispatch function

  // --- Use Redux State for Authentication and Hydration ---
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  // Select the isHydrated flag from your slice
  const isHydrated = useSelector((state: RootState) => state.auth.isHydrated || false);

  // Effect to dispatch hydration thunk on mount
  useEffect(() => {
    console.log("RootLayoutNav mounted, dispatching hydrateAuthState...");
    // Dispatch the thunk when the component mounts.
    // This will start the process of loading state and setting isHydrated.
    dispatch(hydrateAuthState());
  }, [dispatch]); // Include dispatch in dependencies

  // Effect to handle redirects based on Redux auth state and current route
  useEffect(() => {
    console.log(`[Navigation Effect] isHydrated: ${isHydrated}, isAuthenticated: ${isAuthenticated}, segments: ${segments.join('/')}`);

    // --- Wait for Hydration to Complete ---
    // The hydration thunk must finish and set isHydrated = true for this to proceed
    if (!isHydrated) {
      console.log("[Navigation Effect] Waiting for hydration...");
      return; // Don't redirect until state is loaded from storage and isHydrated is true
    }

    console.log("[Navigation Effect] Hydration complete. Checking auth state.");

    // Determine if the current route is within the authentication group
    const inAuthGroup = segments[0] === "(auth)";

    // --- Navigation Logic based on Redux State ---
    if (isAuthenticated && inAuthGroup) {
      // User is logged in (per Redux) AND is in the auth group, redirect to app
      console.log("Redux state: Logged in, redirecting from auth to app...");
      router.replace("/(screens)/profile"); // Redirect to your main app entry point
    } else if (!isAuthenticated && !inAuthGroup) {
      // User is NOT logged in (per Redux) AND is NOT in the auth group, redirect to auth
      console.log("Redux state: Not logged in, redirecting from app to auth...");
      router.replace("/(auth)/login"); // Redirect to your main auth entry point
    } else {
      console.log("Redux state and route group match. No redirect needed.");
    }
    // Depend on states and router/segments for re-evaluation
  }, [isAuthenticated, isHydrated, segments, router]);

  // Show a loading indicator while state is hydrating from storage
  // This condition is true initially because isHydrated starts as false
  if (!isHydrated) {
    console.log("Rendering loading indicator...");
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
        <Text>Loading app state...</Text>
      </View>
    );
  }

  // Once hydrated (isHydrated is true), render the stack navigator
  console.log("Hydration complete. Rendering Stack navigator.");
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "white" },
      }}
    >
      {/* Define your route groups here */}
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(app)" options={{ headerShown: false }} /> {/* Assuming your app screens are in a group like this */}
      {/* Add any other global routes */}
    </Stack>
  );
}

// Top-level layout wrapping with Provider
export default function RootLayout() {
  // Keep the Provider here wrapping everything
  return (
    <Provider store={store}>
      {/* Render the navigation logic component */}
      <RootLayoutNav />
    </Provider>
  );
}