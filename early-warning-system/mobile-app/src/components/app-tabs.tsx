import { NativeTabs } from "expo-router/unstable-native-tabs";

import { BrandColors } from "@/constants/brand";
import { Colors } from "@/constants/theme";

export default function AppTabs() {
  const colors = Colors.light;

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={BrandColors.skySoft}
      labelStyle={{ selected: { color: BrandColors.forest } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require("@/assets/images/tabIcons/home.png")}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="learn">
        <NativeTabs.Trigger.Label>Learn</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "book", selected: "book.fill" }}
          md={{ default: "menu_book", selected: "menu_book" }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "person", selected: "person.fill" }}
          md={{ default: "person", selected: "account_circle" }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
