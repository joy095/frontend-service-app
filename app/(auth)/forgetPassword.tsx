import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  Pressable,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Feather } from "@expo/vector-icons";
import { register } from "../../utils/api";
import { storeTokens } from "../../utils/auth";
import { ScrollView } from "react-native-gesture-handler";
import * as Yup from "yup";

// Yup validation schema
const schema = Yup.object().shape({
  username: Yup.string().required("Username is required"),
  email: Yup.string()
    .email()
    .matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
      message: "Please enter a valid email address",
    })
    .required("Email is required"),
  password: Yup.string()
    .matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/, {
      message:
        "Password must be at least 8 characters long and include a number.",
    })
    .required("Password is required"),
});

const Button = ({
  text,
  onPress,
  errors,
}: {
  text: string;
  onPress: () => void;
  errors: Record<string, string>;
}) => {
  const backgroundColorRef = useRef(new Animated.Value(0)).current;

  const handlePress = () => {
    Animated.timing(backgroundColorRef, {
      toValue: 1,
      duration: 60,
      useNativeDriver: false,
    }).start();
  };

  const handleRelease = () => {
    Animated.timing(backgroundColorRef, {
      toValue: 0,
      duration: 60,
      useNativeDriver: false,
    }).start();
  };

  const backgroundColor = backgroundColorRef.interpolate({
    inputRange: [0, 1],
    outputRange: ["#3A71DA", "#3A71DA99"],
  });

  return (
    <Pressable
      onPressIn={handlePress}
      onPressOut={handleRelease}
      onPress={onPress}
      disabled={Object.values(errors).some((error) => error !== "")}
    >
      <Animated.View
        style={[
          styles.buttonContainer,
          {
            backgroundColor: Object.values(errors).some((error) => error !== "")
              ? "#648DDB99"
              : backgroundColor,
          },
        ]}
      >
        <Text style={styles.buttonText}>{text}</Text>
      </Animated.View>
    </Pressable>
  );
};

// Custom form field component to reduce repetition
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

export default function forgetPassword() {
  const router = useRouter();

  const [formState, setFormState] = useState({
    username: "",
    email: "",
    password: "",
    secureTextEntry: true,
  });

  const [errors, setErrors] = useState({
    username: "",
    email: "",
    password: "",
  });

  type FormField = keyof typeof errors;
  const updateFormState = (field: FormField, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing again
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleRegister = async () => {
    try {
      // Validate fields
      await schema.validate(
        {
          username: formState.username,
          email: formState.email,
          password: formState.password,
        },
        { abortEarly: false }
      );

      // Clear errors
      setErrors({ username: "", email: "", password: "" });

      // Proceed with API call
      const { accessToken, refreshToken } = await register(
        formState.username,
        formState.email,
        formState.password
      );

      await storeTokens(accessToken, refreshToken);
      router.replace("/(tabs)");
    } catch (err) {
      // Handle Yup validation errors
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
        // Handle API errors
        console.error("Registration error:", err);
        // You could set general error state here
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

      <View>
        <Text style={styles.heading}>Forgot password</Text>
        <Text style={{ marginTop: 15, marginBottom: 15, color: "#ccc" }}>
          Please enter your email to reset the password
        </Text>
      </View>

      <FormField
        value={formState.email}
        onChangeText={(text) => updateFormState("email", text)}
        placeholder="Enter your email"
        error={errors.email}
        autoCapitalize="none"
      />

      <View style={styles.buttonWrapper}>
        <Button
          text="Reset Password"
          onPress={handleRegister}
          errors={errors}
        />
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
    padding: 5, // Increased touch target
  },
  heading: {
    color: "#1E1E1E",
    fontWeight: "600",
    fontSize: 20,
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
    backgroundColor: "transparent", // Changed from white to transparent
    paddingHorizontal: 4,
    zIndex: 1, // Changed from -1 to 1
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
    padding: 5, // Increased touch target
  },
  buttonWrapper: {
    marginTop: 5,
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
});
