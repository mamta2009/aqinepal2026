import Svg, { Circle, Path, Rect } from "react-native-svg";

/** Simple robot mark for the aqiHelp floating button. */
export function RobotIcon({
  size = 26,
  color = "#ffffff",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        d="M12 2v2.2"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={3.2} r={1.1} fill={color} />
      <Rect
        x={4.5}
        y={5.5}
        width={15}
        height={11}
        rx={3.5}
        stroke={color}
        strokeWidth={1.8}
        fill="none"
      />
      <Circle cx={9} cy={10.5} r={1.35} fill={color} />
      <Circle cx={15} cy={10.5} r={1.35} fill={color} />
      <Path
        d="M9 13.6h6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M8 16.5v2.2M16 16.5v2.2"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M7 20.5h10"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}
