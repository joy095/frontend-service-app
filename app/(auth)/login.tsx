// src/screens/Login.tsx
import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Image,
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
import { useSelector } from "react-redux"; // Import useSelector
import { RootState } from "../../src/store/store"; // Import RootState type

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
  keyboardType = "default", // Added keyboardType for consistency
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  toggleSecureEntry?: () => void;
  error?: string; // Make error optional
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: TextInput["props"]["keyboardType"];
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const isPlaceholderSmall = isFocused || value.length > 0; // Determine if placeholder is small


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
        keyboardType={keyboardType} // Pass keyboardType
      />
      <Text
        style={[
          styles.placeholderText,
          isPlaceholderSmall && styles.placeholderTextSmall,
        ]}
      >
        {placeholder}
      </Text>
      {secureTextEntry !== undefined && toggleSecureEntry && ( // Only show icon if toggle function is provided
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

  // Select isAuthenticated state from Redux store
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  // RTK Query hook for login mutation
  const [loginMutationTrigger, { isLoading, isError, error, isSuccess }] =
    useLoginMutation();

  const [formState, setFormState] = useState({
    username: "",
    password: "",
    secureTextEntry: true, // State to manage password visibility
  });

  const [errors, setErrors] = useState({
    username: "",
    password: "",
  });

  const [generalError, setGeneralError] = useState(""); // State for API or general errors

  type FormFieldKey = keyof Omit<typeof formState, 'secureTextEntry'>; // Type for form field keys, excluding secureTextEntry

  const updateFormState = (field: FormFieldKey, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    // Clear error for the field when user starts typing again
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
      // Attempt to extract backend message first
      if (typeof err.data === 'object' && err.data !== null && 'message' in err.data && typeof err.data.message === 'string') {
        return err.data.message;
      }
      // Handle specific HTTP statuses if no custom message is found
      if (err.status === 401 || err.status === 400) {
        return 'Invalid username or password.'; // Common message for bad credentials
      }
      if (err.status === 403) {
        return 'Account is not verified. Please check your email.'; // Example: If your backend returns 403 for unverified
      }
      if (err.status === 'FETCH_ERROR') {
        return 'Network error. Please check your internet connection.';
      }
      // Fallback for other HTTP errors
      return `Login failed with status: ${err.status}`;
    } else if ('message' in err) {
      // This is likely a SerializedError or a standard JS Error (e.g., from .unwrap())
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
      setGeneralError(""); // Clear general error on successful validation

      console.log("Attempting to login...");
      // Trigger the RTK Query login mutation
      const credentials: LoginCredentials = {
        username: formState.username.trim(), // Trim whitespace before sending
        password: formState.password,
      };

      // Use .unwrap() to handle success/error within this async function
      // The onQueryStarted in apiSlice handles the setAuthData dispatch and storage save
      await loginMutationTrigger(credentials).unwrap();

      // If we reach here, the login mutation was successful (onQueryStarted already ran
      // and updated the Redux state, setting isAuthenticated to true).
      console.log("Login mutation successful via unwrap(). State should be updating.");

      // Navigation is now handled by the useEffect watching `isAuthenticated`

    } catch (err) {
      // Handle Yup validation errors OR RTK Query API errors caught by unwrap()
      console.error("Login process caught error:", err);

      if (err instanceof Yup.ValidationError) {
        const newErrors = { username: "", password: "" };
        err.inner.forEach((validationError) => {
          if (validationError.path && validationError.path in newErrors) {
            newErrors[validationError.path as keyof typeof newErrors] =
              validationError.message ?? ''; // Add empty string fallback
          }
        });
        setErrors(newErrors);
        // Set a general error message indicating validation issues, if needed
        setGeneralError("Please fix the validation errors above.");
      } else {
        // Handle RTK Query errors (from the API call) caught by .unwrap()
        setGeneralError(getErrorMessage(err as FetchBaseQueryError | SerializedError));
        // Optionally clear password field on API error for security
        setFormState(prev => ({ ...prev, password: "" }));
      }
    }
  };

  // Effect to handle navigation after authentication state changes
  useEffect(() => {
    console.log("Login screen: useEffect running. Current isAuthenticated:", isAuthenticated, "isSuccess:", isSuccess); // Added isSuccess log
    if (isAuthenticated) {
      console.log("Login screen: User is authenticated, navigating to main app.");
      // Replace the current screen with the authenticated route
      // Replace '(tabs)/home' with the correct path to your main screen or tab navigator
      router.replace('/(screens)/profile'); // Example: Assuming authenticated screens are under '(tabs)'
    }
    // Note: This effect doesn't need to handle isError or isLoading directly
    // as handleLogin and the error message display handle those.
  }, [isAuthenticated, router, isSuccess]); // Added isSuccess to dependency array


  // Determine if the login button should be disabled
  const isLoginButtonDisabled = isLoading || Object.values(errors).some(error => error !== '') || !formState.username || !formState.password;


  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled" // Keeps keyboard open when tapping outside inputs
    >
      {/* Back button */}
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color="black" />
      </Pressable>

      {/* Logo */}
      <Image
        source={require("../../assets/images/logo.png")}
        style={styles.logo}
        resizeMode="contain"
        accessible={true}
        accessibilityLabel="App logo"
      />

      {/* Heading */}
      <Text style={styles.heading}>Welcome Back!</Text>
      <Text style={styles.subheading}>Sign in to continue.</Text>


      {/* Username/Email Field */}
      <FormField
        value={formState.username}
        onChangeText={(text) => updateFormState("username", text)}
        placeholder="Username or Email" // More descriptive placeholder
        error={errors.username}
        autoCapitalize="none"
        keyboardType="email-address" // Suggest email keyboard if users can login by email
      />

      {/* Password Field */}
      <FormField
        value={formState.password}
        onChangeText={(text) => updateFormState("password", text)}
        placeholder="Password"
        secureTextEntry={formState.secureTextEntry}
        toggleSecureEntry={toggleSecureEntry}
        error={errors.password}
      />

      {/* Forgot Password Link */}
      <View style={styles.linkContainer}>
        <Link href="/(auth)/forgetPassword" style={styles.link}>
          Forgot password?
        </Link>
      </View>

      {/* Display the general error if it exists */}
      {generalError ? (
        <Text
          style={[styles.errorText, { textAlign: "center", marginBottom: 15, fontSize: 14 }]} // Added margin and increased font size
        >
          {generalError}
        </Text>
      ) : null}

      {/* Login Button */}
      <Pressable
        style={({ pressed }) => [
          {
            transform: [{ scale: pressed ? 0.97 : 1 }],
            opacity: pressed || isLoginButtonDisabled ? 0.6 : 1, // Dim button when pressed or disabled
          },
          styles.button,
          isLoginButtonDisabled && styles.buttonDisabled // Add a style for disabled state if needed
        ]}
        onPress={handleLogin} // Bind handleLogin to the Pressable's onPress
        disabled={isLoginButtonDisabled} // Disable button while loading or validation fails
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" /> // Show loading indicator based on RTK Query state
        ) : (
          <Text style={styles.buttonText}>Login</Text>
        )}
      </Pressable>

      {/* Sign Up Link */}
      <View style={styles.signupContainer}>
        <Text style={styles.signupText}>Don't have an account?</Text>
        <Link href="/(auth)/register" style={styles.link}>
          Sign up
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1, // Use flexGrow for ScrollView content
    marginLeft: "auto",
    marginRight: "auto",
    padding: 20,
    paddingTop: 60,
    maxWidth: 600,
    width: "100%",
    justifyContent: 'center', // Center content vertically if it doesn't fill screen
  },
  backButton: {
    position: 'absolute', // Position absolutely
    top: 40, // Adjust top/left padding as needed for header area
    left: 20,
    zIndex: 10, // Ensure it's above other content
    padding: 10, // Increased touch target
  },
  heading: {
    fontSize: 28, // Larger heading
    fontWeight: 'bold',
    color: '#1E1E1E',
    textAlign: 'center',
    marginBottom: 10,
  },
  subheading: {
    fontSize: 18,
    color: '#555',
    textAlign: 'center',
    marginBottom: 30, // Space before inputs
  },
  logo: {
    width: 150, // Adjust logo size
    height: 60, // Adjust logo size
    marginBottom: 20, // Space below logo
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
    paddingTop: 15, // Adjust padding for floating placeholder
    fontSize: 16,
    borderRadius: 15,
    backgroundColor: '#fff', // Add background color
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
    backgroundColor: "#fff", // Background color to cover input text underneath
    paddingHorizontal: 4,
    zIndex: 1, // Ensure placeholder is above input text
    pointerEvents: 'none', // Ensure text input is still tappable
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
    zIndex: 2,
  },
  linkContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 20, // More space below forgot password link
  },
  button: {
    backgroundColor: "#3A71DA",
    paddingVertical: 15, // Increased vertical padding
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 25,
    marginBottom: 15,
    minHeight: 50, // Ensure a minimum height for the button
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 18, // Larger font size
    fontWeight: "700", // Bolder font weight
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
    textDecorationLine: 'underline', // Add underline to link
  },
});