import React, { useRef } from 'react';
import { View, Animated, TouchableWithoutFeedback } from 'react-native';

interface GlareHoverProps {
  children: React.ReactNode;
  glareColor?: string;
  glareOpacity?: number;
  glareAngle?: number;
  glareSize?: number;
  transitionDuration?: number;
  playOnce?: boolean;
  onPress?: () => void;
}

const GlareHover: React.FC<GlareHoverProps> = ({
  children,
  glareColor = '#ffffff',
  glareOpacity = 0.4,
  glareAngle = -30,
  glareSize = 300,
  transitionDuration = 600,
  playOnce = false,
  onPress,
}) => {
  const glareAnimation = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.timing(glareAnimation, {
      toValue: 1,
      duration: transitionDuration,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (!playOnce) {
      Animated.timing(glareAnimation, {
        toValue: 0,
        duration: transitionDuration,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePress = () => {
    onPress?.();
  };

  const glareTranslateX = glareAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-glareSize, glareSize],
  });

  const glareOpacityValue = glareAnimation.interpolate({
    inputRange: [0, 0.3, 0.7, 1],
    outputRange: [0, glareOpacity, glareOpacity, 0],
  });

  return (
    <TouchableWithoutFeedback
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
    >
      <View style={{ position: 'relative', overflow: 'hidden' }}>
        {children}
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            transform: [
              { translateX: glareTranslateX },
              { rotate: `${glareAngle}deg` },
            ],
            opacity: glareOpacityValue,
            backgroundColor: glareColor,
            width: glareSize,
            height: '100%',
            pointerEvents: 'none',
          }}
        />
      </View>
    </TouchableWithoutFeedback>
  );
};

export default GlareHover;
