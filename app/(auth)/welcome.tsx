import { router } from "expo-router";
import React from "react";
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  Image,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from "react-native";

export default function welcome() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Image
            source={require("../../assets/images/welcome.png")}
            style={styles.heroImage}
            resizeMode="contain"
          />
        </View>
        <View style={styles.content}>
          <View style={styles.contentHeader}>
            <Text style={styles.title}>Join Aura</Text>
            <Text style={styles.text}>
              Connect with people, learn and grow {"\n"} wite similar interest
              people
            </Text>
          </View>

          <Pressable
            onPress={() => {
              router.push("/(auth)/test");
            }}
            style={({ pressed }) => [
              {
                transform: [{ scale: pressed ? 0.97 : 1 }],
                opacity: pressed ? 0.6 : 1,
              },
              styles.button,
            ]}
          >
            <View>
              <Text style={styles.buttonText}>Test</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => {
              router.push("/(auth)/register");
            }}
            style={({ pressed }) => [
              {
                transform: [{ scale: pressed ? 0.97 : 1 }],
                opacity: pressed ? 0.6 : 1,
              },
              styles.button,
            ]}
          >
            <View>
              <Text style={styles.buttonText}>Get started</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => {
              router.push("/(auth)/login");
            }}
            style={({ pressed }) => [
              {
                transform: [{ scale: pressed ? 0.97 : 1 }],
                opacity: pressed ? 0.6 : 1,
              },
              styles.buttonOutline,
            ]}
          >
            <View>
              <Text>Already have an account</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "500",
    color: "#281b52",
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 40,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
    color: "#545454",
    textAlign: "center",
    marginBottom: 30,
  },
  /** Hero */
  hero: {
    margin: 12,
    borderRadius: 16,
    padding: 16,
  },
  heroImage: {
    width: "100%",
    height: 400,
  },
  /** Content */
  content: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  contentHeader: {
    paddingHorizontal: 24,
  },

  /** Button */
  button: {
    backgroundColor: "#3A71DA",
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 25,
    marginBottom: 15,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },

  buttonOutline: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 25,
    borderColor: "#ccc",
    borderWidth: 1,
    marginBottom: 15,
  },
  buttonOulineText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2A2A2A",
  },
});
