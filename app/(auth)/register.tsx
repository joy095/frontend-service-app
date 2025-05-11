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
import { register } from "../../src/utils/api";
import { storeTokens } from "../../src/utils/auth";
import { ScrollView } from "react-native-gesture-handler";
import * as Yup from "yup";

// Yup validation schema
const schema = Yup.object().shape({
  username: Yup.string().required("Username is required"),
  email: Yup.string()
    .email("Please enter a valid email address")
    .matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
      message: "Please enter a valid email address",
    })
    .required("Email is required"),
  password: Yup.string()
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,20}$/, {
      message:
        "Password must be between 8 and 20 characters long and include uppercase, lowercase, number, and special character (!@#$%^&*).",
    })
    .required("Password is required"),
});

// Custom input with floating placeholder
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

export default function Register() {
  const router = useRouter();

  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);

  const [formState, setFormState] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
    secureTextEntry: true,
  });

  const [errors, setErrors] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
  });

  type FormField = keyof typeof errors;

  const updateFormState = (field: FormField, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const toggleSecureEntry = () => {
    setLoading(true);
    setGeneralError("");
    setFormState((prev) => ({
      ...prev,
      secureTextEntry: !prev.secureTextEntry,
    }));
  };

  const handleRegister = async () => {
    try {
      await schema.validate(
        {
          firstName: formState.firstName,
          lastName: formState.lastName,
          username: formState.username,
          email: formState.email,
          password: formState.password,
        },
        { abortEarly: false }
      );

      setErrors({ firstName: "", lastName: "", username: "", email: "", password: "" });

      const { accessToken, refreshToken } = await register(
        formState.username,
        formState.email,
        formState.password
      );

      await storeTokens(accessToken, refreshToken);
      router.replace("/(tabs)");
    } catch (err) {
      if (err instanceof Yup.ValidationError) {
        const newErrors = { username: "", email: "", password: "" };

        err.inner.forEach((validationError: Yup.ValidationError) => {
          if (validationError.path && validationError.path in newErrors) {
            newErrors[validationError.path as keyof typeof newErrors] =
              validationError.message;
          }
        });

        setErrors(newErrors);
      } else {
        console.error("Registration error:", err);
      }
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
        value={formState.firstName}
        onChangeText={(text) => updateFormState("firstName", text)}
        placeholder="Jason"
        error={errors.firstName}
        autoCapitalize="none"
      />

      <FormField
        value={formState.lastName}
        onChangeText={(text) => updateFormState("lastName", text)}
        placeholder="Paul"
        error={errors.lastName}
        autoCapitalize="none"
      />

      <FormField
        value={formState.email}
        onChangeText={(text) => updateFormState("email", text)}
        placeholder="Email"
        error={errors.email}
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
          <Text style={styles.buttonText}>Continue</Text>
        )}
      </Pressable>

      <View style={styles.signupContainer}>
        <Text style={styles.signupText}>Already have an account?</Text>
        <Link href="/(auth)/login" style={styles.link}>
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
    maxWidth: 1200,
    width: "100%",
    marginHorizontal: "auto",
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
  button: {
    backgroundColor: "#3A71DA",
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 25,
    marginBottom: 15,
  },
  buttonContainer: {
    alignItems: "center",
    borderRadius: 20,
    padding: 12,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
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

  textInput: {
    borderWidth: 1,
    borderColor: "black",
    marginBottom: 5,
    padding: 10,
  },
});
