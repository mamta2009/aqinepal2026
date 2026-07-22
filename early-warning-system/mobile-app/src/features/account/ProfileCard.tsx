import { Text, View } from 'react-native';
import { AccountSectionAccent, FeatureSection } from '@/components/FeatureSection';
import type { AuthProfile } from '@/types/auth';

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="border-b border-neutral-100 py-2 dark:border-neutral-800">
      <Text className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</Text>
      <Text className="mt-0.5 text-sm text-neutral-900 dark:text-white">
        {value && String(value).trim() ? String(value) : '—'}
      </Text>
    </View>
  );
}

interface ProfileCardProps {
  profile: AuthProfile | undefined;
  facilityReportingReady: boolean;
}

export function ProfileCard({ profile, facilityReportingReady }: ProfileCardProps) {
  if (!profile) {
    return (
      <FeatureSection accent={AccountSectionAccent.profile}>
        <Text className="mb-2 text-sm font-semibold text-neutral-900 dark:text-white">
          My registration
        </Text>
        <Text className="text-sm text-neutral-500">Loading profile…</Text>
      </FeatureSection>
    );
  }

  const cities =
    (profile.cities && profile.cities.length > 0
      ? profile.cities.join(', ')
      : profile.city) || null;
  const facilities =
    (profile.facility_names && profile.facility_names.length > 0
      ? profile.facility_names.join(', ')
      : profile.facility_name) || null;

  return (
    <FeatureSection accent={AccountSectionAccent.profile}>
      <Text className="mb-1 text-sm font-semibold text-neutral-900 dark:text-white">
        My registration
      </Text>
      <Text className="mb-3 text-xs leading-4 text-neutral-500 dark:text-neutral-400">
        After you sign in (password or one-time code), your saved enrolment details load here — cities,
        channels, verification, and facility linkage. Update preferences through your administrator if
        something is wrong.
      </Text>
      <Row label="Name" value={profile.name} />
      <Row label="Email" value={profile.email} />
      <Row label="Phone" value={profile.phone_number} />
      <Row label="WhatsApp" value={profile.whatsapp_number} />
      <Row label="Role" value={profile.contact_type} />
      <Row label="Coverage areas" value={cities} />
      <Row label="Registered facilities" value={facilities} />
      <Row
        label="Alert channels"
        value={(profile.preferred_channels || []).join(', ') || null}
      />
      <Row
        label="Environmental topics"
        value={(profile.environmental_topics || []).join(', ') || null}
      />
      <Row label="Language" value={profile.language} />
      <Row label="Verification" value={profile.verification_status} />
      <Row label="Partner approval" value={profile.approval_status} />
      <Row
        label="Account active"
        value={
          profile.active === undefined || profile.active === null
            ? null
            : profile.active
              ? 'Yes'
              : 'No'
        }
      />
      <Row
        label="Facility reporting"
        value={
          facilityReportingReady || profile.facility_reporting_ready
            ? 'Ready'
            : 'Not ready'
        }
      />
      <Row label="Facility ID (scope)" value={profile.facility_id} />
      <Row label="Contact reference ID" value={profile._id} />
    </FeatureSection>
  );
}
