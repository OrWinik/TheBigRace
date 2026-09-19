import { Tabs } from 'expo-router';
import { Image } from 'react-native';
import { C, F } from '../../constants/theme';

export default function BottomBar() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.onVariant,
        headerShown: false,
        tabBarStyle: {
          height: 80,
          paddingBottom: 5,
          paddingTop: 5,
          backgroundColor: C.surfaceLow,
          borderTopWidth: 2.5,
          borderTopColor: C.outline,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: F.semi,
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