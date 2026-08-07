import Svg, { Circle, Path } from "react-native-svg";

import type { RainIndicator } from "@/lib/weather-rain";

const COLORS = {
  Raining: "#176b8c",
  Wet: "#5ba3c4",
  Dry: "#d97706",
  Unavailable: "#8aa0ab",
} as const;

/**
 * Distinct rain-status icons (shape + colour) for Home.
 * Raining = blue storm cloud with heavy drops
 * Wet = light-blue cloud with drizzle dashes
 * Dry = amber sun
 * Unavailable = muted cloud with slash
 */
export function RainStatusIcon({
  status,
  size = 40,
}: {
  status: RainIndicator["status"];
  size?: number;
}) {
  const color = COLORS[status];
  const stroke = {
    stroke: color,
    strokeWidth: 2.25,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (status === "Raining") {
    return (
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        accessibilityElementsHidden>
        <Path
          d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"
          fill="none"
          {...stroke}
        />
        <Path d="m8 19-1 2" {...stroke} />
        <Path d="m12 19-1 2" {...stroke} />
        <Path d="m16 19-1 2" {...stroke} />
        <Path d="m9 15-1 2" {...stroke} />
        <Path d="m13 15-1 2" {...stroke} />
        <Path d="m17 15-1 2" {...stroke} />
      </Svg>
    );
  }

  if (status === "Wet") {
    return (
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        accessibilityElementsHidden>
        <Path
          d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"
          fill="none"
          {...stroke}
        />
        <Circle cx={8} cy={15} r={1.1} fill={color} stroke="none" />
        <Circle cx={8} cy={19.5} r={1.1} fill={color} stroke="none" />
        <Circle cx={12} cy={17} r={1.1} fill={color} stroke="none" />
        <Circle cx={12} cy={21.5} r={1.1} fill={color} stroke="none" />
        <Circle cx={16} cy={15} r={1.1} fill={color} stroke="none" />
        <Circle cx={16} cy={19.5} r={1.1} fill={color} stroke="none" />
      </Svg>
    );
  }

  if (status === "Dry") {
    return (
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        accessibilityElementsHidden>
        <Circle cx={12} cy={12} r={4} fill="none" {...stroke} />
        <Path d="M12 2v2" {...stroke} />
        <Path d="M12 20v2" {...stroke} />
        <Path d="m4.93 4.93 1.41 1.41" {...stroke} />
        <Path d="m17.66 17.66 1.41 1.41" {...stroke} />
        <Path d="M2 12h2" {...stroke} />
        <Path d="M20 12h2" {...stroke} />
        <Path d="m6.34 17.66-1.41 1.41" {...stroke} />
        <Path d="m19.07 4.93-1.41 1.41" {...stroke} />
      </Svg>
    );
  }

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityElementsHidden>
      <Path d="m2 2 20 20" {...stroke} />
      <Path
        d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"
        fill="none"
        {...stroke}
      />
      <Path
        d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"
        fill="none"
        {...stroke}
      />
    </Svg>
  );
}
