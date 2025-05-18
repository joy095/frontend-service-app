// src/components/UserProfile.tsx
import React from "react";
import { View, Text, ActivityIndicator, Button, Alert } from "react-native"; // Import Alert
import { useGetUserQuery, useLogoutMutation } from "../services/apiSlice";
import { User } from "../types";

interface UserProfileProps {
  username: string | null | undefined;
}

export default function UserProfile({ username }: UserProfileProps) {
  const {
    data: fetchedData,
    isLoading: isUserLoading,
    isError: isUserError,
    error: userError,
    isFetching: isUserFetching,
    isSuccess: isUserSuccess,
  } = useGetUserQuery(username as string, {
    skip: !username,
  });

  // Use the logout mutation hook
  const [logout, { isLoading: isLoggingOut, isError: isLogoutError, error: logoutError }] = useLogoutMutation();

  // Safely access the nested user object
  const user: User | undefined = fetchedData?.user;

  if (isUserLoading || isUserFetching) {
    console.log("UserProfile: Showing loading...");
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading user profile...</Text>
      </View>
    );
  }

  if (isUserError) {
    console.log("UserProfile: Showing error...");
    console.error("Failed to fetch user profile:", userError);
    const errorMessage =
      (userError as any)?.status === 401
        ? "Session expired. Please log in again."
        : "Error loading user profile.";
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "red" }}>{errorMessage}</Text>
      </View>
    );
  }

  if (!username) {
    console.log("UserProfile: Username prop is missing/null.");
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Please log in to view profile.</Text>
      </View>
    );
  }

  // THIS CHECK IS CRUCIAL
  if (!user) {
    console.log("UserProfile: Data fetched successfully, but the nested 'user' object is missing or falsy.");
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>User data not found or incomplete.</Text>
      </View>
    );
  }



  console.log("UserProfile: Data available and nested user object found. Rendering profile.");
  console.log(" Nested user object:", user);
  console.log(" user.username:", user.username);
  console.log(" user.email:", user.email);
  console.log(" user.first_name:", user.firstName);
  console.log(" user.last_name:", user.lastName);


  // Handle logout button press
  const handleLogout = async () => {
    console.log("UserProfile: Logout button pressed.");
    try {
      console.log("UserProfile: Calling logout mutation...");

      // Call the logout mutation without any parameters
      if (!user.id) {
        console.warn("UserProfile: Cannot logout because user ID is missing.");
        Alert.alert("Logout Failed", "Missing user ID.");
        return;
      }
      await logout({ user_id: user.id }).unwrap();


      console.log('UserProfile: Backend logout call successful (mutation resolved), frontend logout dispatched via onQueryStarted.');

      // You might want to show a success message
      Alert.alert("Success", "You have been logged out successfully.");

    } catch (error) {
      console.error('UserProfile: Backend logout request failed (mutation rejected/unwrapped error):', error);

      // Show an error message but note that the user is still logged out from the frontend
      Alert.alert(
        "Logout Status",
        "You have been logged out, but there was an issue communicating with the server.",
        [{ text: "OK" }]
      );
    }
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>User Profile</Text>
      <Text style={{ fontSize: 16, marginBottom: 5 }}>Username: {user.username}</Text>
      <Text style={{ fontSize: 16, marginBottom: 5 }}>Email: {user.email}</Text>
      <Text style={{ fontSize: 16, marginBottom: 5 }}>First Name: {user.firstName}</Text>
      <Text style={{ fontSize: 16, marginBottom: 5 }}>Last Name: {user.lastName}</Text>

      <View style={{ marginTop: 20 }}>
        <Button
          onPress={handleLogout}
          title={isLoggingOut ? 'Logging out...' : 'Logout'}
          disabled={isLoggingOut}
          color="red"
        />
      </View>

      {isLogoutError && (
        <Text style={{ color: 'red', marginTop: 10 }}>
          Logout Error: {(logoutError as any)?.message || 'An error occurred during logout.'}
        </Text>
      )}
    </View>
  );
}