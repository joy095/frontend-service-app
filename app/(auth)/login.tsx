import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Image,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Link, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Feather } from "@expo/vector-icons";
import { login } from "../../utils/api";
import { storeTokens } from "../../utils/auth";
import { ScrollView } from "react-native-gesture-handler";
import * as Yup from "yup";

// Yup validation schema
const schema = Yup.object().shape({
  username: Yup.string().required("Username is required"),
  password: Yup.string()
    .matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/, {
      message:
        "Password must be at least 8 characters long and include a number.",
    })
    .required("Password is required"),
});

// Custom form field component
const FormField = ({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  toggleSecureEntry,
  error,
  autoCapitalize = "none",
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  toggleSecureEntry?: () => void;
  error: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.inputContainer}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, error && styles.inputError]}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(value.length > 0)}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
      />
      <Text
        style={[
          styles.placeholderText,
          (isFocused || value.length > 0) && styles.placeholderTextSmall,
        ]}
      >
        {placeholder}
      </Text>
      {secureTextEntry !== undefined && (
        <Pressable style={styles.eyeIcon} onPress={toggleSecureEntry}>
          <Feather
            name={secureTextEntry ? "eye-off" : "eye"}
            size={24}
            color="#555"
          />
        </Pressable>
      )}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

export default function Login() {
  const router = useRouter();

  const [formState, setFormState] = useState({
    username: "",
    password: "",
    secureTextEntry: true,
  });

  const [errors, setErrors] = useState({
    username: "",
    password: "",
  });

  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);

  type FormField = keyof typeof errors;
  const updateFormState = (field: FormField, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const toggleSecureEntry = () => {
    setFormState((prev) => ({
      ...prev,
      secureTextEntry: !prev.secureTextEntry,
    }));
  };

  const handleRegister = async () => {
    setLoading(true);
    setGeneralError("");
    try {
      await schema.validate(
        {
          username: formState.username,
          password: formState.password,
        },
        { abortEarly: false }
      );

      setErrors({ username: "", password: "" });

      const { accessToken, refreshToken } = await login(
        formState.username,
        formState.password
      );

      await storeTokens(accessToken, refreshToken);
      router.replace("/(tabs)");
    } catch (err) {
      if (err instanceof Yup.ValidationError) {
        const newErrors = { username: "", password: "" };

        err.inner.forEach((validationError: Yup.ValidationError) => {
          if (validationError.path && validationError.path in newErrors) {
            newErrors[validationError.path as keyof typeof newErrors] =
              validationError.message;
          }
        });

        setErrors(newErrors);
      } else {
        console.error("Login error:", err);
        setGeneralError("Login failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color="black" />
      </Pressable>

      <Image
        source={require("../../assets/images/logo.png")}
        style={styles.logo}
        resizeMode="contain"
        accessible={true}
        accessibilityLabel="App logo"
      />

      <FormField
        value={formState.username}
        onChangeText={(text) => updateFormState("username", text)}
        placeholder="Username"
        error={errors.username}
        autoCapitalize="none"
      />

      <FormField
        value={formState.password}
        onChangeText={(text) => updateFormState("password", text)}
        placeholder="Password"
        secureTextEntry={formState.secureTextEntry}
        toggleSecureEntry={toggleSecureEntry}
        error={errors.password}
      />

      <View style={styles.linkContainer}>
        <Link href="/(auth)/forgetPassword" style={styles.link}>
          Forgot password?
        </Link>
      </View>

      {generalError ? (
        <Text
          style={[styles.errorText, { textAlign: "center", marginBottom: 10 }]}
        >
          {generalError}
        </Text>
      ) : null}

      <Pressable
        onPress={handleRegister}
        style={({ pressed }) => [
          {
            transform: [{ scale: pressed ? 0.97 : 1 }],
            opacity: pressed ? 0.6 : 1,
          },
          styles.button,
        ]}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Get started</Text>
        )}
      </Pressable>

      <View style={styles.signupContainer}>
        <Text style={styles.signupText}>Don't have an account?</Text>
        <Link href="/(auth)/register" style={styles.link}>
          Sign in
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
  },
  backButton: {
    marginBottom: 20,
    padding: 5,
  },
  logo: {
    width: 200,
    height: 80,
    marginBottom: 30,
    alignSelf: "center",
  },
  inputContainer: {
    position: "relative",
    marginBottom: 15,
  },
  input: {
    height: 56,
    borderColor: "#ccc",
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingTop: 15,
    fontSize: 16,
    borderRadius: 15,
  },
  inputError: {
    borderColor: "#FF6B6B",
  },
  placeholderText: {
    position: "absolute",
    left: 15,
    top: 18,
    fontSize: 16,
    color: "#999",
    backgroundColor: "transparent",
    paddingHorizontal: 4,
    zIndex: 1,
  },
  placeholderTextSmall: {
    top: 8,
    fontSize: 12,
    color: "#777",
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  eyeIcon: {
    position: "absolute",
    right: 10,
    top: 10,
    padding: 5,
  },
  linkContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 10,
  },
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
  signupContainer: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 25,
    marginBottom: 20,
  },
  signupText: {
    color: "#777",
    fontSize: 15,
    fontWeight: "500",
  },
  link: {
    color: "#648DDB",
    fontSize: 15,
    fontWeight: "600",
  },
});
