// screens/VerifyEmail.tsx
import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  Pressable,
  ActivityIndicator,
  Alert, // Import Alert for displaying API errors
} from "react-native";
import { Link, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Feather } from "@expo/vector-icons";
import { ScrollView } from "react-native-gesture-handler";
import * as Yup from "yup";
import { useVerifyOtpMutation } from "../../src/services/apiSlice"; // Import the RTK Query mutation
import { useSelector } from "react-redux"; // Import useSelector
import { RootState } from "../../src/store/store"; // Import RootState type
import { RegisteredUser } from "../../src/types"; // Import RegisteredUser type


// Yup validation schema - now only for OTP
const schema = Yup.object().shape({
  otp: Yup.string()
    .trim() // Trim whitespace
    .matches(/^\d+$/, 'OTP must contain only digits') // Ensure only digits
    .length(6, "OTP must be exactly 6 digits")
    .required("OTP is required"),
});

// Custom Button Component
const Button = ({
  text,
  onPress,
  disabled, // Use disabled prop instead of checking errors internally
  isLoading, // Add isLoading prop
}: {
  text: string;
  onPress: () => void;
  disabled: boolean;
  isLoading: boolean; // Track loading state for the button
}) => {
  const backgroundColorRef = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    if (!disabled && !isLoading) {
      Animated.timing(backgroundColorRef, {
        toValue: 1,
        duration: 60,
        useNativeDriver: false,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (!disabled && !isLoading) {
      Animated.timing(backgroundColorRef, {
        toValue: 0,
        duration: 60,
        useNativeDriver: false,
      }).start();
    }
  };

  const backgroundColor = backgroundColorRef.interpolate({
    inputRange: [0, 1],
    outputRange: ["#3A71DA", "#3A71DA99"], // Base color, Pressed color
  });

  const dynamicBackgroundColor = disabled || isLoading ? "#648DDB99" : backgroundColor; // Dim color if disabled or loading


  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled || isLoading} // Disable if the button is already disabled or loading
    >
      <Animated.View
        style={[
          styles.buttonContainer,
          {
            backgroundColor: dynamicBackgroundColor,
          },
        ]}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" /> // Show loading indicator when loading
        ) : (
          <Text style={styles.buttonText}>{text}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
};

// Custom form field component
const FormField = ({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  toggleSecureEntry,
  error,
  autoCapitalize = "none",
  keyboardType = "default", // Added keyboardType
  maxLength, // Added maxLength
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  toggleSecureEntry?: () => void;
  error?: string; // Make error optional
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: TextInput["props"]["keyboardType"]; // Allow specifying keyboard type
  maxLength?: number; // Allow setting max length
}) => {
  const [isFocused, setIsFocused] = useState(false);

  // Determine if the placeholder should be small (focused or has value)
  const isPlaceholderSmall = isFocused || value.length > 0;

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
        maxLength={maxLength} // Pass maxLength
      />

      <Text
        style={[
          styles.placeholderText,
          isPlaceholderSmall && styles.placeholderTextSmall,
        ]}
      >
        {placeholder}
      </Text>

      {/* Eye icon only for secure text entry fields */}
      {secureTextEntry !== undefined && toggleSecureEntry && (
        <Pressable style={styles.eyeIcon} onPress={toggleSecureEntry}>
          <Feather
            name={secureTextEntry ? "eye-off" : "eye"}
            size={24}
            color="#555"
          />
        </Pressable>
      )}

      {/* Display error message if present */}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};


export default function VerifyEmail() {
  const router = useRouter();

  // Get registered user data from Redux state
  const registeredUser: RegisteredUser | null = useSelector(
    (state: RootState) => state.auth.registeredUser
  );

  // RTK Query hook for verifyOtp mutation
  const [verifyOtp, { isLoading, isSuccess, isError, error }] = useVerifyOtpMutation();

  const [formState, setFormState] = useState({
    otp: "",
  });

  const [errors, setErrors] = useState({
    otp: "",
  });

  // Redirect if registeredUser data is missing (e.g., user came directly to this screen)
  useEffect(() => {
    if (!registeredUser) {
      console.warn("No registered user data found, redirecting to register.");
      // Replace history to prevent going back to verify screen
      router.replace('/(auth)/register');
      // Alternatively, redirect to login or an error screen
      // router.replace('/(auth)/login');
    }
  }, [registeredUser, router]); // Depend on registeredUser and router

  // Redirect after successful verification (isAuthenticated becomes true)
  // This is a more robust way to handle navigation after the state update
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  useEffect(() => {
    if (isAuthenticated) {
      console.log("User is now authenticated, navigating to profile.");
      router.replace("/(screens)/profile"); // Or wherever your main authenticated route is
    }
  }, [isAuthenticated, router]);


  // Handle API error display
  useEffect(() => {
    if (isError && error) {
      console.error("Verify OTP API error:", error);
      // Display a user-friendly error message
      let errorMessage = "An unexpected error occurred.";

      if ('status' in error) {
        // Handle FetchBaseQueryError
        if (error.status === 400) {
          // Assuming backend returns a message for invalid OTP, etc.
          errorMessage = (error.data as any)?.message || "Invalid OTP or verification failed.";
        } else if (error.status === 404) {
          errorMessage = "Verification data not found. Please try registering again.";
        } else {
          errorMessage = `API error: ${error.status}`;
        }
      } else {
        // Handle other potential errors (e.g., network)
        errorMessage = error.message || "Network error or unknown issue.";
      }

      Alert.alert("Verification Failed", errorMessage);
    }
  }, [isError, error]); // Depend on isError and error


  type FormFieldKey = keyof typeof formState; // Define a type for form field keys
  const updateFormState = (field: FormFieldKey, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    // Clear error for the field when user starts typing again
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleVerifyOtp = async () => {
    // Ensure registeredUser data is available before attempting verification
    if (!registeredUser) {
      console.error("Attempted to verify OTP without registered user data.");
      // Optionally show an error message or redirect
      Alert.alert("Error", "Verification data missing. Please register again.");
      router.replace('/(auth)/register');
      return;
    }

    try {
      // Validate fields using Yup
      await schema.validate(formState, { abortEarly: false });

      // Clear previous validation errors
      setErrors({ otp: "" });

      console.log("Attempting to verify OTP...");
      // Call the RTK Query mutation
      // The VerifyOtpRequest type requires email, otp, and username
      await verifyOtp({
        email: registeredUser.email, // Get email from registeredUser state
        username: registeredUser.username, // Get username from registeredUser state
        otp: formState.otp, // Get OTP from form state
      }).unwrap(); // Use .unwrap() to get the payload or throw error

      // On successful unwrap, the onQueryStarted hook in apiSlice
      // will handle fetching user data, dispatching setAuthData,
      // and saving tokens/user to AsyncStorage.
      // Navigation will be handled by the useEffect watching `isAuthenticated`.

      console.log("Verify OTP mutation called successfully.");

    } catch (err) {
      console.error("Verify OTP process caught error:", err);
      // Handle Yup validation errors
      if (err instanceof Yup.ValidationError) {
        const newErrors = { otp: "" };

        err.inner.forEach((validationError: Yup.ValidationError) => {
          if (validationError.path && validationError.path in newErrors) {
            newErrors[validationError.path as keyof typeof newErrors] =
              validationError.message;
          }
        });

        setErrors(newErrors);
        // Do not show Alert for validation errors, they are displayed below fields
      } else {
        // RTK Query errors (API errors, network errors, etc.)
        // These are handled by the useEffect watching `isError` and `error` state
      }
    }
  };

  // Determine if the verify button should be disabled
  const isVerifyButtonDisabled = Object.values(errors).some(error => error !== '') || isLoading || !registeredUser;


  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled" // Keeps keyboard open when tapping outside inputs
    >
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color="black" />
      </Pressable>

      <View>
        <Text style={styles.heading}>Check your email</Text>
        <Text style={{ marginTop: 15, marginBottom: 15, color: "#555" }}>
          {/* Dynamically show the email if available */}
          We sent a 6-digit code to{" "}
          <Text style={{ fontWeight: "bold" }}>
            {registeredUser?.email || "your email address"}
          </Text>
          . Enter the code below to verify your account.
        </Text>
      </View>

      <FormField
        value={formState.otp}
        onChangeText={(text) => updateFormState("otp", text)}
        placeholder="Enter 6-digit code"
        error={errors.otp}
        keyboardType="number-pad" // Use number pad for OTP
        maxLength={6} // Limit input to 6 characters
      />

      <View style={styles.buttonWrapper}>
        <Button
          text="Verify Email"
          onPress={handleVerifyOtp} // Call the verification handler
          disabled={isVerifyButtonDisabled} // Pass the calculated disabled state
          isLoading={isLoading} // Pass loading state from mutation
        />
      </View>

      {/* Link for resending email - implement this logic separately */}
      <View style={styles.signupContainer}>
        <Text style={styles.signupText}> Haven't received the code? </Text>
        {/* Replace with logic to trigger resend OTP API call */}
        <Link href={{ pathname: "/(auth)/resend-otp", params: { email: registeredUser?.email || '' } }} asChild>
          <Pressable>
            <Text style={styles.link}>
              Resend code
            </Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

// Keep your existing styles
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
    color: "#1E1E1E",
    fontWeight: "600",
    fontSize: 24, // Slightly larger heading
    marginBottom: 10,
    textAlign: 'center', // Center heading
  },
  inputContainer: {
    position: "relative",
    marginBottom: 15,
    marginTop: 15, // Add some space above first input
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
    top: 10, // Adjust positioning
    padding: 10, // Increased touch target
    zIndex: 2, // Ensure icon is above placeholder/input
  },
  buttonWrapper: {
    marginTop: 20, // More space above the button
  },
  buttonContainer: {
    alignItems: "center",
    borderRadius: 20,
    padding: 15, // Increased padding
    minHeight: 50, // Ensure minimum height even when loading
    justifyContent: 'center', // Center content vertically
  },
  buttonText: {
    color: "white",
    fontSize: 18, // Larger font size
    fontWeight: "700", // Bolder font weight
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