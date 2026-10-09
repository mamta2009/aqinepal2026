import { Text, View } from "react-native";
import { AccountSectionAccent, FeatureSection } from "@/components/FeatureSection";
import type { AuthProfile } from "@/types/auth";

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="border-b border-border py-2">
      <Text className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
        {label}
      </Text>
      <Text className="mt-0.5 text-sm font-bold text-ink">
        {value && String(value).trim() ? String(value) : "—"}
      </Text>
    </View>
  );
}

function roleLabel(contactType?: string | null) {
  switch (contactType) {
    case "health_worker":
      return "Health worker / doctor";
    case "parent":
      return "Parent / guardian";
    case "admin":
      return "Administrator";
    case "government":
      return "Government official";
    case "school_admin":
      return "School administrator";
    default:
      return contactType || null;
  }
}

interface ProfileCardProps {
  profile: AuthProfile | undefined;
  facilityReportingReady: boolean;
}

export function ProfileCard({
  profile,
  facilityReportingReady,
}: ProfileCardProps) {
  if (!profile) {
    return (
      <FeatureSection accent={AccountSectionAccent.profile}>
        <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
          Your registration
        </Text>
        <Text className="mb-2 text-lg font-extrabold text-ink">Profile</Text>
        <Text className="text-sm text-muted">Loading profile…</Text>
      </FeatureSection>
    );
  }

  const isSchoolAdmin = profile.contact_type === "school_admin";
  const coverage =
    (profile.cities && profile.cities.length > 0
      ? profile.cities.join(", ")
      : profile.city) || null;
  const schoolName =
    profile.facility_names?.[0] || profile.facility_name || null;

  return (
    <FeatureSection accent={AccountSectionAccent.profile}>
      <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
        Your registration
      </Text>
      <Text className="mb-3 text-lg font-extrabold text-ink">Profile</Text>
      <Row label="Name" value={profile.name} />
      <Row label="Email" value={profile.email} />
      <Row label="Phone" value={profile.phone_number} />
      <Row label="Role" value={roleLabel(profile.contact_type)} />
      <Row label="Coverage" value={coverage} />
      <Row label="Language" value={profile.language} />
      <Row label="Verification" value={profile.verification_status} />
      <Row label="Partner approval" value={profile.approval_status} />
      <Row
        label="Facility reporting"
        value={
          facilityReportingReady || profile.facility_reporting_ready
            ? "Ready"
            : "Not ready"
        }
      />
      {isSchoolAdmin ? (
        <>
          <Row label="School name" value={schoolName} />
          <Row label="School contact" value={profile.school_contact} />
          <Row label="School address" value={profile.school_address} />
          <Row label="About the school" value={profile.school_information} />
        </>
      ) : null}
    </FeatureSection>
  );
}
