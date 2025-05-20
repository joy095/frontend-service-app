// In your parent component (e.g., a ProfileScreen)
import { useSelector } from 'react-redux';
import { RootState } from '../../src/store/store';
import UserProfile from '../../src/components/UserProfile';
import { View } from 'react-native';

function ProfileScreen() {
  const authState = useSelector((state: RootState) => state.auth);
  console.log("Parent Component: Auth state is:", authState);
  const username = authState.user?.username;
  console.log("Parent Component: Username from state is:", username);

  return (
    <View>
      <UserProfile username={username} />
    </View>
  );
}

export default ProfileScreen;