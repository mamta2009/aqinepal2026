import type { ReactElement } from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

const SIZE = 22;

type IconProps = {
  color: string;
  size?: number;
};

function HomeIcon({ color, size = SIZE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.5 10.5 12 4l7.5 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-4v6H5.5a1 1 0 0 1-1-1v-9.5Z"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MapIcon({ color, size = SIZE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21s6.5-5.2 6.5-10.2A6.5 6.5 0 0 0 5.5 10.8C5.5 15.8 12 21 12 21Z"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={10.5} r={2.2} stroke={color} strokeWidth={1.9} />
    </Svg>
  );
}

function BotIcon({ color, size = SIZE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3v2.2"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={2.6} r={1} fill={color} />
      <Rect
        x={5}
        y={6}
        width={14}
        height={10}
        rx={3}
        stroke={color}
        strokeWidth={1.9}
      />
      <Circle cx={9.2} cy={10.5} r={1.2} fill={color} />
      <Circle cx={14.8} cy={10.5} r={1.2} fill={color} />
      <Path
        d="M9 13.4h6M8.5 16v2.2M15.5 16v2.2M8 20.2h8"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function MailIcon({ color, size = SIZE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x={3.5}
        y={5.5}
        width={17}
        height={13}
        rx={2.2}
        stroke={color}
        strokeWidth={1.9}
      />
      <Path
        d="m5 8 7 5 7-5"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function AlertIcon({ color, size = SIZE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 4.5 3.8 19.2h16.4L12 4.5Z"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Path
        d="M12 10v4.2"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={16.6} r={1} fill={color} />
    </Svg>
  );
}

function CompareIcon({ color, size = SIZE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 7h11M15.5 4.5 18.5 7 15.5 9.5"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17 17H6M8.5 14.5 5.5 17l3 2.5"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function AboutIcon({ color, size = SIZE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.2} stroke={color} strokeWidth={1.9} />
      <Path
        d="M12 10.8V17"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={7.8} r={1.05} fill={color} />
    </Svg>
  );
}

function BookIcon({ color, size = SIZE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16.5H7.5A2.5 2.5 0 0 0 5 22V5.5Z"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Path
        d="M5 18.5h12.5"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function PeopleIcon({ color, size = SIZE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={8.5} r={2.4} stroke={color} strokeWidth={1.9} />
      <Path
        d="M4.5 18.5c.4-3 2.4-4.5 4.5-4.5s4.1 1.5 4.5 4.5"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
      <Circle cx={16.5} cy={9} r={2} stroke={color} strokeWidth={1.9} />
      <Path
        d="M15 14c1.8.2 3.3 1.4 3.8 3.5"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function SchoolIcon({ color, size = SIZE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m3.5 10 8.5-5 8.5 5-8.5 5-8.5-5Z"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Path
        d="M7 12.2v4.3c0 .8 2.2 2 5 2s5-1.2 5-2v-4.3"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Path
        d="M20 10.5V16"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function GuidesIcon({ color, size = SIZE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 4.5h10a1.5 1.5 0 0 1 1.5 1.5v13l-3-2-3 2-3-2-3 2V6A1.5 1.5 0 0 1 7 4.5Z"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Path
        d="M9 9h6M9 12.5h6"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function PencilIcon({ color, size = SIZE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m5 19 1.2-4.6L15.8 4.8a2 2 0 0 1 2.9 0l.5.5a2 2 0 0 1 0 2.9L9.6 17.8 5 19Z"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Path
        d="m13.8 6.8 3.4 3.4"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const ICONS: Record<string, (props: IconProps) => ReactElement> = {
  home: HomeIcon,
  map: MapIcon,
  "aqi-help": BotIcon,
  register: MailIcon,
  alerts: AlertIcon,
  compare: CompareIcon,
  about: AboutIcon,
  parents: PeopleIcon,
  schools: SchoolIcon,
  students: PencilIcon,
  guides: GuidesIcon,
  learn: BookIcon,
};

/** Feature-matched SVG icon for a drawer nav item. */
export function DrawerNavIcon({
  id,
  color,
  size = SIZE,
}: {
  id: string;
  color: string;
  size?: number;
}) {
  const Icon = ICONS[id] ?? AboutIcon;
  return <Icon color={color} size={size} />;
}
