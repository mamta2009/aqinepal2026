export type DrawerNavAction =
  | { type: "route"; href: string }
  | { type: "alerts" }
  | { type: "browser"; path: string };

export interface DrawerNavItem {
  id: string;
  label: string;
  icon: string;
  action: DrawerNavAction;
  /** Pathname prefixes that mark this item active. */
  match: string[];
}

export interface DrawerNavGroup {
  id: string;
  title: string;
  items: DrawerNavItem[];
}

export const DRAWER_NAV: DrawerNavGroup[] = [
  {
    id: "main",
    title: "Main",
    items: [
      {
        id: "home",
        label: "Home",
        icon: "⌂",
        action: { type: "route", href: "/" },
        match: ["/", "/(tabs)", "/(tabs)/"],
      },
      {
        id: "map",
        label: "Air Quality Map",
        icon: "◎",
        action: { type: "route", href: "/map" },
        match: ["/map"],
      },
      {
        id: "aqi-help",
        label: "Ask aqiHelp",
        icon: "⌬",
        action: { type: "route", href: "/aqi-help" },
        match: ["/aqi-help"],
      },
    ],
  },
  // Hide Learn sidebar group for now — Learn tab remains available.
  // {
  //   id: "learn",
  //   title: "Learn",
  //   items: [
  //     {
  //       id: "parents",
  //       label: "Parents",
  //       icon: "☺",
  //       action: { type: "route", href: "/learn/parents" },
  //       match: ["/learn/parents"],
  //     },
  //     {
  //       id: "schools",
  //       label: "Schools",
  //       icon: "▤",
  //       action: { type: "route", href: "/learn/schools" },
  //       match: ["/learn/schools"],
  //     },
  //     {
  //       id: "students",
  //       label: "Students",
  //       icon: "✎",
  //       action: { type: "route", href: "/learn/students" },
  //       match: ["/learn/students"],
  //     },
  //     {
  //       id: "guides",
  //       label: "Educational Resources",
  //       icon: "☰",
  //       action: { type: "route", href: "/guides" },
  //       match: ["/guides", "/learn/guide"],
  //     },
  //   ],
  // },

  {
    id: "tools",
    title: "Tools",
    items: [
      {
        id: "register",
        label: "Register for alerts",
        icon: "✉",
        action: { type: "route", href: "/register" },
        match: ["/register", "/verify"],
      },
      {
        id: "alerts",
        label: "Recent alerts",
        icon: "⚠",
        action: { type: "alerts" },
        match: ["/alerts"],
      },
      {
        id: "compare",
        label: "Compare cities",
        icon: "⇆",
        action: { type: "route", href: "/compare" },
        match: ["/compare"],
      },
    ],
  },
  {
    id: "project",
    title: "Project",
    items: [
      {
        id: "about",
        label: "About",
        icon: "ℹ",
        action: { type: "route", href: "/about" },
        match: ["/about"],
      },
    ],
  },
];

export function isDrawerItemActive(
  pathname: string,
  item: DrawerNavItem,
): boolean {
  const path = pathname.replace(/\/$/, "") || "/";
  if (item.id === "home") {
    return (
      path === "/" ||
      path === "/(tabs)" ||
      path.endsWith("/(tabs)") ||
      path === "/index" ||
      path.endsWith("/(tabs)/index")
    );
  }
  return item.match.some((prefix) => {
    const p = prefix.replace(/\/$/, "") || "/";
    return path === p || path.startsWith(`${p}/`);
  });
}
