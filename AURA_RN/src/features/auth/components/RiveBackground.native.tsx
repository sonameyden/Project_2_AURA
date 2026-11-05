import { Fit, RiveView, useRiveFile } from '@rive-app/react-native';
import { StyleSheet } from 'react-native';

import authAnimation from '../../../../assets/rive/auth-background.riv';

export function RiveBackground() {
  const { riveFile, error } = useRiveFile(authAnimation);

  if (error) {
    console.error('Unable to load the AURA authentication animation.', error);
    return null;
  }
  if (!riveFile) return null;

  return (
    <RiveView
      file={riveFile}
      stateMachineName="State Machine 1"
      autoPlay
      fit={Fit.Cover}
      onError={(riveError) => console.error('AURA authentication animation failed.', riveError)}
      style={StyleSheet.absoluteFill}
    />
  );
}
