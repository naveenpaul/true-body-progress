import type { PressableProps } from 'react-native';
import * as React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  I18nManager,
  Pressable,

  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import colors from '@/components/ui/colors';

import { Text } from './text';

const SIZE = 20;
const WIDTH = 50;
const HEIGHT = 28;
const THUMB_HEIGHT = 22;
const THUMB_WIDTH = 22;
const THUMB_OFFSET = 4;

export type RootProps = {
  onChange: (checked: boolean) => void;
  checked?: boolean;
  className?: string;
  accessibilityLabel: string;
} & Omit<PressableProps, 'onPress'>;

export type IconProps = {
  checked: boolean;
};

export function Root({
  checked = false,
  children,
  onChange,
  disabled,
  className = '',
  ...props
}: RootProps) {
  const handleChange = useCallback(() => {
    onChange(!checked);
  }, [onChange, checked]);

  return (
    <Pressable
      onPress={handleChange}
      className={`flex-row items-center ${className} ${
        disabled ? 'opacity-50' : ''
      }`}
      accessibilityState={{ checked }}
      disabled={disabled}
      {...props}
    >
      {children}
    </Pressable>
  );
}

type LabelProps = {
  text: string;
  className?: string;
  testID?: string;
};

function Label({ text, testID, className = '' }: LabelProps) {
  return (
    <Text testID={testID} className={`${className} pl-2`}>
      {text}
    </Text>
  );
}

export function CheckboxIcon({ checked = false }: IconProps) {
  const color = checked ? colors.primary[300] : colors.charcoal[400];
  const anim = useRef(new Animated.Value(checked ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: checked ? 1 : 0,
      duration: 100,
      useNativeDriver: false,
    }).start();
  }, [checked, anim]);

  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', color],
  });

  return (
    <Animated.View
      style={{
        height: SIZE,
        width: SIZE,
        borderColor: color,
        borderWidth: 2,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor,
      }}
    >
      <Animated.View style={{ opacity: anim }}>
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <Path
            d="m16.726 7-.64.633c-2.207 2.212-3.878 4.047-5.955 6.158l-2.28-1.928-.69-.584L6 12.66l.683.577 2.928 2.477.633.535.591-.584c2.421-2.426 4.148-4.367 6.532-6.756l.633-.64L16.726 7Z"
            fill="#fff"
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

function CheckboxRoot({ checked = false, children, ...props }: RootProps) {
  return (
    <Root checked={checked} accessibilityRole="checkbox" {...props}>
      {children}
    </Root>
  );
}

function CheckboxBase({
  checked = false,
  testID,
  label,

  ...props
}: RootProps & { label?: string }) {
  return (
    <CheckboxRoot checked={checked} testID={testID} {...props}>
      <CheckboxIcon checked={checked} />
      {label
        ? (
            <Label
              text={label}
              testID={testID ? `${testID}-label` : undefined}
              className="pr-2"
            />
          )
        : null}
    </CheckboxRoot>
  );
}

export const Checkbox = Object.assign(CheckboxBase, {
  Icon: CheckboxIcon,
  Root: CheckboxRoot,
  Label,
});

export function RadioIcon({ checked = false }: IconProps) {
  const color = checked ? colors.primary[300] : colors.charcoal[400];
  const anim = useRef(new Animated.Value(checked ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: checked ? 1 : 0,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [checked, anim]);

  return (
    <View
      style={{
        height: SIZE,
        width: SIZE,
        borderColor: color,
        borderWidth: 2,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
      }}
    >
      <Animated.View
        style={{
          width: 10,
          height: 10,
          borderRadius: 10,
          opacity: anim,
          backgroundColor: checked ? colors.primary[300] : 'transparent',
        }}
      />
    </View>
  );
}

function RadioRoot({ checked = false, children, ...props }: RootProps) {
  return (
    <Root checked={checked} accessibilityRole="radio" {...props}>
      {children}
    </Root>
  );
}

function RadioBase({
  checked = false,
  testID,
  label,
  ...props
}: RootProps & { label?: string }) {
  return (
    <RadioRoot checked={checked} testID={testID} {...props}>
      <RadioIcon checked={checked} />
      {label
        ? (
            <Label text={label} testID={testID ? `${testID}-label` : undefined} />
          )
        : null}
    </RadioRoot>
  );
}

export const Radio = Object.assign(RadioBase, {
  Icon: RadioIcon,
  Root: RadioRoot,
  Label,
});

export function SwitchIcon({ checked = false }: IconProps) {
  const targetX = checked
    ? THUMB_OFFSET
    : WIDTH - THUMB_WIDTH - THUMB_OFFSET;
  const translateVal = I18nManager.isRTL ? targetX : -targetX;

  const anim = useRef(new Animated.Value(translateVal)).current;
  const backgroundColor = checked ? colors.primary[300] : colors.charcoal[400];

  useEffect(() => {
    Animated.spring(anim, {
      toValue: translateVal,
      overshootClamping: true,
      useNativeDriver: true,
    }).start();
  }, [translateVal, anim]);

  return (
    <View style={{ width: 50, justifyContent: 'center' }}>
      <View style={{ overflow: 'hidden', borderRadius: 9999 }}>
        <View
          style={{
            width: WIDTH,
            height: HEIGHT,
            backgroundColor,
          }}
        />
      </View>
      <Animated.View
        style={{
          height: THUMB_HEIGHT,
          width: THUMB_WIDTH,
          position: 'absolute',
          backgroundColor: 'white',
          borderRadius: 13,
          right: 0,
          transform: [{ translateX: anim }],
        }}
      />
    </View>
  );
}
function SwitchRoot({ checked = false, children, ...props }: RootProps) {
  return (
    <Root checked={checked} accessibilityRole="switch" {...props}>
      {children}
    </Root>
  );
}

function SwitchBase({
  checked = false,
  testID,
  label,
  ...props
}: RootProps & { label?: string }) {
  return (
    <SwitchRoot checked={checked} testID={testID} {...props}>
      <SwitchIcon checked={checked} />
      {label
        ? (
            <Label text={label} testID={testID ? `${testID}-label` : undefined} />
          )
        : null}
    </SwitchRoot>
  );
}

export const Switch = Object.assign(SwitchBase, {
  Icon: SwitchIcon,
  Root: SwitchRoot,
  Label,
});
