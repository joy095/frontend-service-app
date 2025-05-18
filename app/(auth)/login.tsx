import { useState, useEffect } from "react";
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
import { ScrollView } from "react-native-gesture-handler";
import { useLoginMutation } from "../../src/services/apiSlice";
import * as Yup from "yup";
import { LoginCredentials } from "../../src/types"; // Import the type for credentials
import { FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import { SerializedError } from '@reduxjs/toolkit'; // Import types for error

// Yup validation schema
const schema = Yup.object().shape({
  username: Yup.string().required("Username is required"),
  password: Yup.string().required("Password is required"),
});

// Custom form field component (Keep this as is)
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

  // Use the RTK Query login mutation hook
  // loginMutationTrigger is the function to call to start the mutation
  // { isLoading, isError, error } are states provided by the hook
  const [loginMutationTrigger, { isLoading, isError, error }] = // Removed isSuccess, data from here
    useLoginMutation();

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

  // Helper to get a user-friendly error message from the RTK Query error object
  const getErrorMessage = (err: FetchBaseQueryError | SerializedError | undefined): string => {
    if (!err) return 'An unexpected error occurred.'; // Generic fallback

    if ('status' in err) {
      // This is a FetchBaseQueryError
      if (typeof err.data === 'object' && err.data !== null && 'message' in err.data && typeof err.data.message === 'string') {
        // Check if the backend returned a specific message in { message: "..." }
        return err.data.message;
      }
      // Handle specific HTTP statuses if no custom message is found
      if (err.status === 401 || err.status === 400) {
        return 'Invalid credentials. Please check your username and password.';
      }
      if (err.status === 'FETCH_ERROR') {
        return 'Network error. Please check your internet connection.';
      }
      // Fallback for other HTTP errors
      return `Login failed with status: ${err.status}`;
    } else if ('message' in err) {
      // This is likely a SerializedError or a standard JS Error
      return `An error occurred: ${err.message}`;
    }

    // Fallback for unknown error structure
    return 'An unexpected error occurred.';
  };


  const handleLogin = async () => {
    setGeneralError(""); // Clear any previous general errors

    try {
      // Validate form inputs using Yup schema
      await schema.validate(
        {
          username: formState.username,
          password: formState.password,
        },
        { abortEarly: false } // Collect all errors
      );

      // If validation passes, clear field-specific errors
      setErrors({ username: "", password: "" });

      // Trigger the RTK Query login mutation
      const credentials: LoginCredentials = {
        username: formState.username,
        password: formState.password,
      };

      // Use .unwrap() to handle success/error within this async function
      // onQueryStarted in apiSlice handles the setTokens dispatch
      const result = await loginMutationTrigger(credentials).unwrap();

      // If we reach here, the login mutation was successful (onQueryStarted already ran)
      console.log("Login successful via unwrap() in component.");

      // --- Navigation handled by _layout.tsx ---
      // _layout.tsx should be watching the isAuthenticated state in Redux.
      // When isAuthenticated becomes true (due to setTokens dispatch),
      // _layout.tsx should automatically handle the redirect, e.g., router.replace('/(tabs)').
      // No need to manually navigate here if _layout is set up correctly.

    } catch (err) {
      // Handle Yup validation errors OR RTK Query API errors caught by unwrap()
      if (err instanceof Yup.ValidationError) {
        const newErrors = { username: "", password: "" };
        err.inner.forEach((validationError) => {
          if (validationError.path && validationError.path in newErrors) {
            newErrors[validationError.path as keyof typeof newErrors] =
              validationError.message ?? ''; // Add empty string fallback
          }
        });
        setErrors(newErrors);
        setGeneralError("Please fix the errors above."); // Indicate validation errors exist
      } else {
        // Handle RTK Query errors (from the API call) caught by .unwrap()
        console.error("Login failed after mutation trigger:", err);
        setGeneralError(getErrorMessage(err as FetchBaseQueryError | SerializedError)); // Use the helper for API errors
      }
    }
  };

  // Optional: Use useEffect only for logging or side effects *not* directly tied to button press
  // For example, if you needed to show a toast message outside this component tree.
  // In this setup, handling errors with .unwrap() and success via Redux state change is cleaner.
  // Keeping a minimal useEffect to observe state changes if desired, but it's less crucial now.
  useEffect(() => {
    // This effect will run when isLoading, isError, error states change
    // onQueryStarted already handled success and token storage.
    // unwrap() in handleLogin already handled API errors for display.
    // So, this effect is primarily for debugging or complex side effects.
    console.log("Login state changed:", { isLoading, isError, error });

    // No need to call setAuthToken here if _layout watches Redux state.
    // No need to set general error here, handleLogin catch block does it.

  }, [isLoading, isError, error]); // Dependencies on the mutation state

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

      {/* Display the general error if it exists */}
      {generalError ? (
        <Text
          style={[styles.errorText, { textAlign: "center", marginBottom: 10 }]}
        >
          {generalError}
        </Text>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          {
            transform: [{ scale: pressed ? 0.97 : 1 }],
            opacity: pressed ? 0.6 : 1,
          },
          styles.button,
        ]}
        onPress={handleLogin} // Bind handleLogin to the Pressable's onPress
        disabled={isLoading} // Disable button while RTK Query is loading
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" /> // Show loading indicator based on RTK Query state
        ) : (
          <Text style={styles.buttonText}>
            Login {/* Text is inside Pressable, no need for separate onPress */}
          </Text>
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
    flex: 1,
    marginLeft: "auto",
    marginRight: "auto",
    padding: 20,
    paddingTop: 60,
    maxWidth: 600,
    width: "100%",
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
    top: 16,
    fontSize: 16,
    color: "#999",
    backgroundColor: "transparent",
    paddingHorizontal: 4,
    zIndex: -1,
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
