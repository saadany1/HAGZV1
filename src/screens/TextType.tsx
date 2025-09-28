import React, { useState, useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';

interface TextTypeProps {
  text: string[];
  typingSpeed?: number;
  pauseDuration?: number;
  showCursor?: boolean;
  cursorCharacter?: string;
  style?: any;
  onComplete?: () => void;
}

const TextType: React.FC<TextTypeProps> = ({
  text,
  typingSpeed = 100,
  pauseDuration = 1000,
  showCursor = true,
  cursorCharacter = "|",
  style,
  onComplete,
}) => {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCursorState, setShowCursorState] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const fullText = text[currentTextIndex];
      
      if (!isDeleting) {
        // Typing
        if (currentText.length < fullText.length) {
          setCurrentText(fullText.slice(0, currentText.length + 1));
        } else {
          // Finished typing, wait then start deleting
          setTimeout(() => {
            setIsDeleting(true);
          }, pauseDuration);
        }
      } else {
        // Deleting
        if (currentText.length > 0) {
          setCurrentText(currentText.slice(0, -1));
        } else {
          // Finished deleting, move to next text
          setIsDeleting(false);
          setCurrentTextIndex((prevIndex) => {
            const nextIndex = (prevIndex + 1) % text.length;
            if (nextIndex === 0 && onComplete) {
              onComplete();
            }
            return nextIndex;
          });
        }
      }
    }, isDeleting ? typingSpeed / 2 : typingSpeed);

    return () => clearTimeout(timeout);
  }, [currentText, isDeleting, currentTextIndex, text, typingSpeed, pauseDuration, onComplete]);

  // Cursor blinking effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursorState(prev => !prev);
    }, 500);

    return () => clearInterval(cursorInterval);
  }, []);

  return (
    <Text style={[styles.text, style]}>
      {currentText}
      {showCursor && showCursorState && (
        <Text style={styles.cursor}>{cursorCharacter}</Text>
      )}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  cursor: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
});

export default TextType;




