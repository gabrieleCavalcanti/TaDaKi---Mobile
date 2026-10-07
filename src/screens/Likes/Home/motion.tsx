import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform } from "react-native";
import type { ReactNode } from "react";
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}
export function Reveal({
  children,
  reduced,
}: {
  children: ReactNode;
  reduced: boolean;
}) {
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced]);
  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [6, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

export function MenuReveal({ children, open, reduced }: { children: ReactNode; open: boolean; reduced: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!open || reduced) { progress.setValue(open ? 1 : 0); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== "web" });
    animation.start(); return () => animation.stop();
  }, [open, reduced, progress]);
  return <Animated.View style={{ opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>{children}</Animated.View>;
}
