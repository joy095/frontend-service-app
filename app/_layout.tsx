import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler"; // <-- import this
import { getAccessToken } from "../utils/auth";
import { StyleSheet } from "react-native";

export default function Layout() {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token = await getAccessToken();
      setAuthenticated(!!token);
      setReady(true);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!ready) return;

    const inAuthGroup = segments[0] === "(auth)";
    if (!authenticated && !inAuthGroup) {
      router.replace("/(auth)/welcome");
    } else if (authenticated && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [segments, authenticated, ready]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <Slot />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
