import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface HourglassLoaderProps {
  size?: number;
  color?: string;
  text?: string;
  textStyle?: any;
  containerStyle?: any;
}

const HourglassLoader: React.FC<HourglassLoaderProps> = ({
  size = 40,
  color = "#4CAF50",
  text,
  textStyle,
  containerStyle,
}) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Rotation animation
    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );

    // Scale animation for pulsing effect
    const scaleAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    rotateAnimation.start();
    scaleAnimation.start();

    return () => {
      rotateAnimation.stop();
      scaleAnimation.stop();
    };
  }, []);

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, containerStyle]}>
      <Animated.View
        style={[
          styles.hourglass,
          {
            width: size,
            height: size,
            borderColor: color,
            transform: [
              { rotate: rotateInterpolate },
              { scale: scaleAnim }
            ],
          },
        ]}
      >
        <View style={[styles.hourglassTop, { borderBottomColor: color }]} />
        <View style={[styles.hourglassBottom, { borderTopColor: color }]} />
        <View style={[styles.hourglassCenter, { backgroundColor: color }]} />
      </Animated.View>
      {text && (
        <Text style={[styles.text, textStyle]}>
          {text}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  hourglass: {
    borderWidth: 3,
    borderRadius: 4,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hourglassTop: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    height: '35%',
    borderBottomWidth: 2,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  hourglassBottom: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    right: 2,
    height: '35%',
    borderTopWidth: 2,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  hourglassCenter: {
    position: 'absolute',
    width: 2,
    height: '30%',
    borderRadius: 1,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
});

export default HourglassLoader;
