// src/components/UserProfile.tsx
import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useGetUserQuery } from "../services/apiSlice";
// *** Import the correct types ***
// Import GetUserResponse for the hook's data type, and User for the nested object's type
import { User } from "../types"; // User type is now the corrected one

interface UserProfileProps {
  username: string | null | undefined;
}

export default function UserProfile({ username }: UserProfileProps) {
  // *** Remove the type arguments here. Let TypeScript infer from apiSlice.ts ***
  const {
    data: fetchedData, // inferred as GetUserResponse | undefined
    isLoading,
    isError,
    error,
    isFetching,
    isSuccess,
  } = useGetUserQuery(username as string, { // <--- NO TYPE ARGUMENTS HERE
    skip: !username,
  });

  // Safely access the nested user object.
  // Type annotation is correct based on GetUserResponse { user: User }
  const user: User | undefined = fetchedData?.user;

  // --- Include ALL necessary checks here ---

  if (isLoading || isFetching) {
    console.log("UserProfile: Showing loading...");
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading user profile...</Text>
      </View>
    );
  }

  if (isError) {
    console.log("UserProfile: Showing error...");
    console.error("Failed to fetch user profile:", error);
    const errorMessage =
      (error as any)?.status === 401
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

  // *** THIS CHECK IS CRUCIAL and must NOT be commented out ***
  if (!user) {
    console.log("UserProfile: Data fetched successfully, but the nested 'user' object is missing or falsy.");
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>User data not found or incomplete.</Text>
      </View>
    );
  }
  // --- End of checks ---


  // If we reach here, 'user' is guaranteed by the checks above to be of type User

  // --- Logic to get the Birth Year (using 'user' of type User) ---
  let birthYear = 'N/A'; // Variable name changed for clarity
  // *** Access user.age here, NOT user.DOB ***
  if (user.age && typeof user.age === 'string' && user.age.length >= 4) {
    try {
      // *** Use user.age here for parsing ***
      const dateObj = new Date(user.age);
      if (!isNaN(dateObj.getTime())) {
        // *** Store year in birthYear variable ***
        birthYear = dateObj.getFullYear().toString();
      } else {
        // *** Log user.age here ***
        console.warn("UserProfile: Failed to parse age string into a valid date:", user.age);
      }
    } catch (e) {
      // *** Log user.age here ***
      console.error("UserProfile: Error during age date parsing:", user.age, e);
    }
  } else {
    // *** Log user.age here ***
    console.warn("UserProfile: user.age is missing, not a string, or too short:", user.age);
  }
  // --- End Birth Year Logic ---


  console.log("UserProfile: Data available and nested user object found. Rendering profile.");
  console.log(" Nested user object:", user); // Log the actual User object
  console.log(" user.username:", user.username);
  console.log(" user.email:", user.email);
  // *** Use correct property names (snake_case) for logs and rendering ***
  console.log(" user.first_name:", user.first_name);
  console.log(" user.last_name:", user.last_name);
  console.log(" user.age:", user.age); // Log the raw age string
  console.log(" Birth Year:", birthYear); // Log the calculated year


  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>User Profile</Text>
      <Text style={{ fontSize: 16, marginBottom: 5 }}>Username: {user.username}</Text>
      <Text style={{ fontSize: 16, marginBottom: 5 }}>Email: {user.email}</Text>
      {/* *** Use the correct snake_case property names in rendering *** */}
      <Text style={{ fontSize: 16, marginBottom: 5 }}>First Name: {user.first_name}</Text>
      <Text style={{ fontSize: 16, marginBottom: 5 }}>Last Name: {user.last_name}</Text>
      {/* *** Display the extracted year variable *** */}
      <Text style={{ fontSize: 16, marginBottom: 5 }}>Birth Year: {birthYear}</Text>
    </View>
  );
}