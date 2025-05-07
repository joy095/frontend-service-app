import { View, Text, Button } from "react-native";
import { useRouter } from "expo-router";
import { clearTokens } from "../../utils/auth";

export default function WelcomeScreen() {
  const router = useRouter();

  const handleLogout = async () => {
    await clearTokens();
    router.replace("/(auth)/login");
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Welcome to the App 🎉</Text>
      <Button title="Logout" onPress={handleLogout} />
    </View>
  );
}
