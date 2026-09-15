import React from 'react';
import { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type TabName = 'library' | 'highlights' | 'stats' | 'settings';

interface Props {
  name: TabName;
  color: ColorValue;
  focused: boolean;
}

export function TabBarIcon({ name, color, focused }: Props) {
  const stroke = color;
  const size = focused ? 24 : 22;
  const strokeWidth = focused ? 2.2 : 1.8;

  if (name === 'library') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 19.5V6.5A2.5 2.5 0 0 1 6.5 4H18a2 2 0 0 1 2 2v13.5"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M8 8h8M8 11h6"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  if (name === 'highlights') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
        <Path
          d="M14 3v5h5"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M8 14h8M8 17h5"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <Rect
          x="8"
          y="10.5"
          width="8"
          height="2.5"
          rx="0.5"
          fill={stroke}
          opacity={0.35}
        />
      </Svg>
    );
  }

  if (name === 'stats') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 19h16"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <Rect
          x="6"
          y="11"
          width="3"
          height="6"
          rx="1"
          fill={focused ? stroke : 'none'}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        <Rect
          x="10.5"
          y="7"
          width="3"
          height="10"
          rx="1"
          fill={focused ? stroke : 'none'}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        <Rect
          x="15"
          y="9"
          width="3"
          height="8"
          rx="1"
          fill={focused ? stroke : 'none'}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12"
        cy="12"
        r="3"
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V19a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 17.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 13a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
