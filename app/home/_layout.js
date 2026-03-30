import { Tabs } from 'expo-router';
import { Image } from 'react-native';

export default function BottomBar() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#69f6b8',
        tabBarInactiveTintColor: '#a3aac4',
        headerShown: false,
        tabBarStyle: {
          height: 80,
          paddingBottom: 5,
          paddingTop: 5,
          backgroundColor: '#091328',
          borderTopWidth: 1,
          borderTopColor: '#192540',
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: 'Race',
          tabBarIcon: ({ color, size }) => (
            <Image
              source={require('../../assets/icons8-home-24.png')}
              style={{ width: size, height: size, tintColor: color }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          tabBarLabel: 'Leaderboard',
          tabBarIcon: ({ color, size }) => (
            <Image
              source={require('../../assets/icons8-leaderboard-24.png')}
              style={{ width: size, height: size, tintColor: color }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Image
              source={require('../../assets/icons8-person-24.png')}
              style={{ width: size, height: size, tintColor: color }}
            />
          ),
        }}
      />
    </Tabs>
  );
}