import { useState, useEffect, useRef } from "react";
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
// Import the RTK Query hooks
import {
  useCheckUsernameAvailabilityQuery,
  useRegisterMutation, // Import the register mutation hook
} from "../../src/services/apiSlice"; // Adjust import path for your apiSlice
// Assuming storeTokens is handled by setAuthData in your apiSlice or authSlice middleware
// import { storeTokens } from "../../src/utils/auth"; // May not be needed anymore
import { ScrollView } from "react-native-gesture-handler";
import * as Yup from "yup";
import { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { SerializedError } from "@reduxjs/toolkit";
// Assume types are imported (e.g., RegisterCredentials)
// import { CheckUsernameAvailabilityResponse, RegisterCredentials } from "../types"; // Adjust import path

// --- FormFieldProps (Keep this as is) ---
interface FormFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  toggleSecureEntry?: () => void;
  error?: string; // Error message
  successMessage?: string; // New prop for success message
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  statusComponent?: React.ReactNode; // Prop for status indicator icon
  inputStyle?: object;
  containerStyle?: object;
}

// --- FormField Component (Keep this as is) ---
const FormField: React.FC<FormFieldProps> = ({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  toggleSecureEntry,
  error,
  successMessage,
  autoCapitalize = "none",
  statusComponent,
  inputStyle,
  containerStyle,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const isSmallPlaceholder = isFocused || value.length > 0;

  return (
    <View style={[styles.inputContainer, containerStyle]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[
          styles.input,
          error && styles.inputError,
          !error && successMessage && styles.inputSuccess,
          inputStyle,
          statusComponent
            ? { paddingRight: secureTextEntry !== undefined ? 70 : 40 }
            : {},
        ]}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(value.length > 0)}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
      />

      <Text
        style={[
          styles.placeholderText,
          isSmallPlaceholder && styles.placeholderTextSmall,
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

      {statusComponent && (
        <View
          style={[
            styles.inputStatus,
            secureTextEntry !== undefined ? { right: 40 } : { right: 15 },
          ]}
        >
          {statusComponent}
        </View>
      )}

      {/* Render Error Message if present */}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Render Success Message ONLY if NO error and successMessage is present */}
      {!error && successMessage ? (
        <Text style={[styles.errorText, styles.successText]}>
          {successMessage}
        </Text>
      ) : null}
    </View>
  );
};

// Yup validation schema (Keep this)
const schema = Yup.object().shape({
  firstName: Yup.string().required("First name is required"),
  lastName: Yup.string().required("Last name is required"),
  username: Yup.string()
    .required("Username is required")
    .min(3, "Username must be at least 3 characters long")
    .max(20, "Username must be no more than 20 characters long"),
  email: Yup.string()
    .email("Please enter a valid email address")
    .matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
      message: "Please enter a valid email address",
    })
    .required("Email is required"),
  password: Yup.string()
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,20}$/,
      {
        message:
          "Password must be 8-20 characters, include uppercase, lowercase, number, and special character (!@#$%^&*).",
      }
    )
    .required("Password is required"),
});

export default function Register() {
  const router = useRouter();

  const [generalError, setGeneralError] = useState("");
  // We use isRegistering from the mutation hook instead of a local loading state
  // const [loading, setLoading] = useState(false); // Removed

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

  // --- State and Effect for Debouncing Username Input ---
  const [debouncedUsername, setDebouncedUsername] = useState("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MIN_USERNAME_CHECK_LENGTH = 3;

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const currentUsername = formState.username.trim();
      if (currentUsername.length >= MIN_USERNAME_CHECK_LENGTH) {
        setDebouncedUsername(currentUsername);
      } else {
        setDebouncedUsername(""); // Clear debounced value if too short
      }
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [formState.username]);
  // --- End Debounce Logic ---

  // --- RTK Query Hook for Username Availability ---
  const {
    data: availabilityData,
    isFetching: isAvailabilityFetching,
    isSuccess: isAvailabilitySuccess,
    isError: isAvailabilityError,
    error: availabilityError,
  } = useCheckUsernameAvailabilityQuery(
    { username: debouncedUsername },
    {
      skip:
        !debouncedUsername ||
        debouncedUsername.length < MIN_USERNAME_CHECK_LENGTH,
    }
  );
  // --- End RTK Query Hook ---

  // --- RTK Query Hook for Register Mutation ---
  // This hook provides the trigger function (registerUser) and the mutation's state
  const [
    registerUser,
    {
      isLoading: isRegistering,
      error: registerError,
      isSuccess: isRegisterSuccess,
      data: registerData,
    },
  ] = useRegisterMutation();
  // --- End RTK Query Hook ---

  type FormFieldKey = keyof typeof errors;

  const updateFormState = (field: FormFieldKey, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
    setGeneralError("");
  };

  const toggleSecureEntry = () => {
    setFormState((prev) => ({
      ...prev,
      secureTextEntry: !prev.secureTextEntry,
    }));
  };

  // --- Helper to render username status/loader based on RTK Query state ---
  const renderUsernameStatus = () => {
    if (isAvailabilityFetching) {
      return <ActivityIndicator size="small" color="#0000ff" />;
    }
    if (isAvailabilitySuccess && availabilityData?.available === true) {
      return <Feather name="check-circle" size={20} color="green" />;
    }
    if (
      (isAvailabilitySuccess && availabilityData?.available === false) ||
      isAvailabilityError
    ) {
      return <Feather name="x-circle" size={20} color="red" />;
    }
    return null;
  };

  // --- Helper to get the availability error message from RTK Query ---
  const getAvailabilityErrorMessage = (): string | undefined => {
    if (
      isAvailabilitySuccess &&
      availabilityData?.available === false &&
      availabilityData.message
    ) {
      return availabilityData.message;
    }
    if (isAvailabilityError) {
      const fbqError = availabilityError as FetchBaseQueryError;
      if (fbqError.data) {
        const errorData = fbqError.data as { error?: string };
        return (
          errorData.error || `Error checking username (${fbqError.status})`
        );
      }
      const serializedError = availabilityError as SerializedError;
      if (serializedError.message) {
        return `Error: ${serializedError.message}`;
      }
      return "An unknown error occurred checking username availability.";
    }
    return undefined;
  };
  // --- End Helpers ---

  // --- Determine the username availability success message ---
  const usernameSuccessMessage =
    !errors.username && // No Yup validation error for username
      !getAvailabilityErrorMessage() && // No availability error from RTK Query
      !isAvailabilityFetching && // Availability check is not in progress
      formState.username.trim().length > 0 && // Username input is not empty
      availabilityData?.available === true // RTK Query confirms username is available
      ? "Username available!"
      : undefined;

  // --- Effect to handle successful registration and navigation ---
  useEffect(() => {
    // Check if the mutation was successful and we have data (tokens, user)
    if (isRegisterSuccess && registerData) {
      console.log("Registration successful, navigating to OTP screen.");
      // The setAuthData dispatch happens in the apiSlice's onQueryStarted for the register mutation.
      // So here, we just navigate.
      router.replace("/(auth)/verify-email"); // Adjust route as needed
    }
  }, [isRegisterSuccess, registerData, router]); // Dependencies for the effect

  // --- Effect to handle registration errors ---
  useEffect(() => {
    if (registerError) {
      console.error("Registration mutation error:", registerError);
      // Clear field errors before setting new ones based on the API error
      setErrors({
        firstName: "",
        lastName: "",
        username: "",
        email: "",
        password: "",
      });
      setGeneralError(""); // Clear general error first

      // Handle the error, potentially showing a general error message or field-specific errors
      const fbqError = registerError as FetchBaseQueryError;

      if (fbqError.data) {
        // Assume backend sends { error: "message" } or { errors: [{ field: "...", message: "..." }] }
        const errorData = fbqError.data as {
          error?: string;
          errors?: { field: string; message: string }[];
        };

        if (errorData.errors && Array.isArray(errorData.errors)) {
          // If backend returns field-specific errors
          const newErrors = { ...errors }; // Start with empty field errors from above
          let hasFieldError = false;
          errorData.errors.forEach((err) => {
            // Ensure the field exists in our form state/errors state
            if (err.field in newErrors) {
              newErrors[err.field as FormFieldKey] = err.message;
              hasFieldError = true;
            }
          });
          setErrors(newErrors);
          if (hasFieldError) {
            setGeneralError("Please fix the form errors above.");
          } else {
            // If backend sends errors array but fields don't match our form
            setGeneralError(
              errorData.error || "Registration failed with specific issues."
            );
          }
        } else if (errorData.error) {
          // If backend sends a single general error message
          // Check for specific messages like username/email taken
          const apiErrorMessage = errorData.error;
          if (apiErrorMessage.includes("Username is already taken")) {
            setErrors((prev) => ({ ...prev, username: apiErrorMessage }));
            setGeneralError("Please fix the errors above.");
          } else if (apiErrorMessage.includes("Email is already taken")) {
            setErrors((prev) => ({ ...prev, email: apiErrorMessage }));
            setGeneralError("Please fix the errors above.");
          } else {
            // Fallback to general error for other single error messages
            setGeneralError(apiErrorMessage);
          }
        } else {
          // Fallback if error.data exists but isn't in expected format
          setGeneralError(`Registration failed: Status ${fbqError.status}`);
        }
      } else {
        // Handle other types of errors (network, parsing, timeout, etc.)
        const serializedError = registerError as SerializedError;
        setGeneralError(
          serializedError.message ||
          "An unknown error occurred during registration."
        );
      }
    }
  }, [registerError, errors]); // Add errors as dependency if updating it within the effect
  // --- End Effect ---

  // Determine the combined username error message to pass to FormField
  // Show Yup error if present, otherwise show the availability error
  const usernameErrorMessage = errors.username || getAvailabilityErrorMessage();

  const handleRegister = async () => {
    // Clear previous general and field-specific errors first
    setErrors({
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      password: "",
    });
    setGeneralError("");

    // Get the potential availability error message early
    const availabilityErrMessage = getAvailabilityErrorMessage();

    try {
      // --- 1. Perform Client-side Yup Validation ---
      await schema.validate(
        {
          firstName: formState.firstName,
          lastName: formState.lastName,
          username: formState.username,
          email: formState.email,
          password: formState.password,
        },
        { abortEarly: false } // Collect all errors, don't stop on the first one
      );

      // --- 2. Perform Final Username Availability Check Before Registering ---
      // Ensure the username input is not empty and meets min length before checking availability status
      if (formState.username.trim().length < MIN_USERNAME_CHECK_LENGTH) {
        // This case should ideally be caught by Yup validation first, but double-check.
        setErrors((prev) => ({
          ...prev,
          username: `Username must be at least ${MIN_USERNAME_CHECK_LENGTH} characters.`,
        }));
        setGeneralError("Please fix the errors above.");
        return; // Stop here
      }

      // Ensure the availability check is not currently running
      if (isAvailabilityFetching) {
        setGeneralError(
          "Please wait, finishing username availability check..."
        );
        return; // Don't proceed while check is in progress
      }

      // Ensure the username has been checked successfully (data is available)
      // AND that it's marked as available.
      if (
        !availabilityData ||
        availabilityData.available === false ||
        isAvailabilityError
      ) {
        // If the username is invalid or couldn't be checked, set the appropriate error
        const finalAvailabilityError =
          availabilityErrMessage ||
          "Username is not available or could not be checked.";
        setErrors((prev) => ({ ...prev, username: finalAvailabilityError }));
        setGeneralError("Please fix the errors above.");
        return; // Stop registration if username is not valid/available
      }
      // --- End Username Availability Check ---

      // If all client-side validations pass AND username is confirmed available,
      // AND the button is not disabled (which accounts for isRegistering),
      // proceed to trigger the registration mutation.

      console.log("All checks passed. Triggering register mutation...");
      // --- 3. Trigger the Register Mutation ---
      // Call the mutation trigger function with the form data
      await registerUser({
        username: formState.username,
        firstName: formState.firstName,
        lastName: formState.lastName,
        email: formState.email,
        password: formState.password,
      }).unwrap(); // Use unwrap() to throw errors and catch them in the catch block

      // If unwrap() succeeds, the useEffect for isRegisterSuccess will handle navigation.
      // If unwrap() fails, the catch block below will handle the error state.
    } catch (err: any) {
      // Errors from Yup validation or the mutation trigger (if unwrap fails)
      // The useEffect for registerError will handle setting specific errors.
      // We don't need to set loading(false) here, RTK Query handles isRegistering.
      console.error("Caught error during handleRegister:", err);
      // No need to duplicate error setting here, the useEffect already handles it.
    }
    // No finally block needed if RTK Query handles loading and error states
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
        source={require("../../assets/images/logo.png")} // Adjust path
        style={styles.logo}
        resizeMode="contain"
        accessible={true}
        accessibilityLabel="App logo"
      />

      {/* Display general error message */}
      {generalError ? (
        <Text style={styles.generalErrorText}>{generalError}</Text>
      ) : null}

      <FormField
        value={formState.firstName}
        onChangeText={(text) => updateFormState("firstName", text)}
        placeholder="First Name"
        error={errors.firstName}
        autoCapitalize="words" // Capitalize words for names
      />

      <FormField
        value={formState.lastName}
        onChangeText={(text) => updateFormState("lastName", text)}
        placeholder="Last Name"
        error={errors.lastName}
        autoCapitalize="words" // Capitalize words for names
      />

      {/* Username FormField with status indicator and combined error/success messages */}

      <FormField
        value={formState.username}
        onChangeText={(text) => updateFormState("username", text)}
        placeholder="Username"
        error={usernameErrorMessage} // Pass the combined error message
        successMessage={usernameSuccessMessage} // Pass the success message
        autoCapitalize="none"
        statusComponent={renderUsernameStatus()} // Pass the status icon component
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
          // Apply disabled style if button is disabled
          (isRegistering ||
            isAvailabilityFetching ||
            (availabilityData && !availabilityData.available) ||
            formState.username.trim().length < MIN_USERNAME_CHECK_LENGTH) &&
          styles.buttonDisabled,
        ]}
        // Disable button if:
        // - The register mutation is currently loading (`isRegistering`)
        // - The availability check is currently fetching (`isAvailabilityFetching`)
        // - The availability check finished and reported username is NOT available (`availabilityData && !availabilityData.available`)
        // - The username length is less than the min check length (disable button before check)
        disabled={
          isRegistering ||
          isAvailabilityFetching ||
          (availabilityData !== undefined && !availabilityData.available) ||
          formState.username.trim().length < MIN_USERNAME_CHECK_LENGTH // Still disable if too short for check
        }
      >
        {isRegistering ? ( // Use isRegistering for the button's loader
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

// --- Updated StyleSheet Definition ---
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: "#fff",
    paddingTop: 60,
    alignItems: "center",
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  backButton: {
    position: "absolute",
    top: 60,
    left: 20,
    zIndex: 1,
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
    marginBottom: 25, // Enough space for message below
    width: "100%",
  },
  input: {
    height: 56,
    borderColor: "#ccc",
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingTop: 15,
    fontSize: 16,
    borderRadius: 15,
    color: "#333",
    width: "100%",
  },
  inputError: {
    borderColor: "#FF6B6B", // Red border for error
  },
  inputSuccess: {
    borderColor: "green", // Green border for success
  },
  placeholderText: {
    position: "absolute",
    left: 15,
    top: 16,
    fontSize: 16,
    color: "#999",
    paddingHorizontal: 4,
    zIndex: -1,
    pointerEvents: "none",
  },
  placeholderTextSmall: {
    top: 8,
    fontSize: 12,
    color: "#777",
    backgroundColor: "white",
    left: 11,
  },
  // --- Error and Success Message Style ---
  errorText: {
    // This style is now used for BOTH error and success messages (positioning)
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
    position: "absolute",
    bottom: -20, // Position below the input container
    left: 15,
    width: "95%", // Prevent text from overlapping status/eye icons
    color: "#FF6B6B", // Default color is red (for errors)
  },
  successText: {
    // This style OVERRIDES the color from errorText for success messages
    color: "green", // Green color for success message
  },
  // --- End Message Styles ---
  generalErrorText: {
    color: "red",
    fontSize: 14,
    marginBottom: 15,
    textAlign: "center",
    width: "100%",
  },
  eyeIcon: {
    position: "absolute",
    right: 15,
    top: 16,
    padding: 5,
    zIndex: 2,
  },
  inputStatus: {
    position: "absolute",
    right: 15,
    top: 16,
    padding: 5,
    zIndex: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    backgroundColor: "#3A71DA",
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 25,
    marginBottom: 15,
    width: "100%",
    height: 50,
  },
  buttonDisabled: {
    backgroundColor: "#a8a8a8",
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
    marginTop: 10,
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
