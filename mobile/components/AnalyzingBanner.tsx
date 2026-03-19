import { useEffect, useRef, useState } from 'react';
import { Animated, ActivityIndicator, Text, StyleSheet, View } from 'react-native';

interface Props {
  visible: boolean;
}

export function AnalyzingBanner({ visible }: Props) {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setShouldRender(false);
        }
      });
    }
  }, [visible]);

  if (!shouldRender) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <ActivityIndicator size="small" color="#666" style={styles.spinner} />
      <Text style={styles.text}>Analyzing speech...</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  spinner: {
    marginRight: 8,
  },
  text: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
});
