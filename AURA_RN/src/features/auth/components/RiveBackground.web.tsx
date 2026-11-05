import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

export function RiveBackground() {
  return (
    <LinearGradient
      colors={['#171226', '#0C0D12', '#0C0D12']}
      locations={[0, 0.62, 1]}
      style={StyleSheet.absoluteFill}
    />
  );
}
