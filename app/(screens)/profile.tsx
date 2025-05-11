// In your parent component (e.g., a ProfileScreen)
import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../src/store/store'; // Adjust path to your store
import UserProfile from '../../src/components/UserProfile'; // Adjust path to your UserProfile
import { View, Text } from 'react-native'; // Assuming React Native context

function ProfileScreen() {
  const authState = useSelector((state: RootState) => state.auth);
  console.log("Parent Component: Auth state is:", authState);
  const username = authState.user?.username;
  console.log("Parent Component: Username from state is:", username);

  console.log("Parent Component: Username from state is:", username); 
  return (
    <View>
      <UserProfile username={username} />
    </View>
  );
}

export default ProfileScreen;