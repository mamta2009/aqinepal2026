import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AuthTextField,
  Banner,
  ChipMultiSelect,
  ConsentToggle,
  PrimaryButton,
} from '@/features/auth/FormFields';
import { AccountSectionAccent, FeatureSection } from '@/components/FeatureSection';
import { useSharedContacts } from '@/hooks/useAuth';
import {
  createSharedContact,
  deleteSharedContact,
  notifySharedContacts,
  updateSharedContact,
} from '@/services/api/auth';
import { toApiError } from '@/services/api/client';
import { BrandColors } from '@/constants/brand';
import { toastError, toastInfo, toastSuccess } from '@/utils/toast';
import type { SharedAlertContact, SharedContactChannel } from '@/types/auth';

const CHANNEL_OPTIONS = [
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
];

function TrashIcon({ color = BrandColors.primary, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M10 11v6M14 11v6" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function EditIcon({ color = BrandColors.secondary, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function emptyForm() {
  return {
    displayName: '',
    channel: 'sms' as SharedContactChannel,
    phone: '+977',
    email: '',
  };
}

export function FriendsFamilyPanel() {
  const queryClient = useQueryClient();
  const listQuery = useSharedContacts(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [channel, setChannel] = useState<SharedContactChannel>('sms');
  const [phone, setPhone] = useState('+977');
  const [email, setEmail] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [consented, setConsented] = useState(false);

  const contacts = listQuery.data?.contacts ?? [];
  const limits = listQuery.data?.limits;
  const isEditing = Boolean(editingId);

  const limitsLine = useMemo(() => {
    if (!limits) return null;
    return `You can store up to ${limits.max_contacts} contacts. Friend/family sends: ${limits.notify_recipients_sent_today} / ${limits.notify_recipients_daily_max} recipients used today (UTC).`;
  }, [limits]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['auth', 'shared-contacts'] });
  };

  const resetForm = () => {
    const empty = emptyForm();
    setEditingId(null);
    setDisplayName(empty.displayName);
    setChannel(empty.channel);
    setPhone(empty.phone);
    setEmail(empty.email);
  };

  const startEdit = (contact: SharedAlertContact) => {
    const ch = (contact.channel || 'sms') as SharedContactChannel;
    setEditingId(contact.id);
    setDisplayName(contact.display_name || '');
    setChannel(ch === 'email' || ch === 'whatsapp' || ch === 'sms' ? ch : 'sms');
    setPhone(contact.phone_e164?.trim() || '+977');
    setEmail(contact.email?.trim() || '');
  };

  const createMutation = useMutation({
    mutationFn: createSharedContact,
    onSuccess: async () => {
      toastSuccess('Contact saved.');
      resetForm();
      await invalidate();
    },
    onError: (error) => toastError(toApiError(error).message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateSharedContact>[1] }) =>
      updateSharedContact(id, body),
    onSuccess: async () => {
      toastSuccess('Contact updated.');
      resetForm();
      await invalidate();
    },
    onError: (error) => toastError(toApiError(error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSharedContact,
    onSuccess: async (_data, id) => {
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      if (editingId === id) resetForm();
      toastSuccess('Contact removed.');
      await invalidate();
    },
    onError: (error) => toastError(toApiError(error).message),
  });

  const deleting = deleteMutation.isPending;
  const saving = createMutation.isPending || updateMutation.isPending;

  const notifyMutation = useMutation({
    mutationFn: notifySharedContacts,
    onSuccess: async (data) => {
      const ok = data.results?.filter((r) => r.ok).length ?? 0;
      const fail = data.results?.filter((r) => !r.ok).length ?? 0;
      const msg = `Sent to ${ok} contact(s)${fail ? `, ${fail} failed` : ''}.`;
      if (fail) toastInfo(msg);
      else toastSuccess(msg);
      setMessage('');
      setConsented(false);
      await invalidate();
    },
    onError: (error) => toastError(toApiError(error).message),
  });

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const onSubmit = () => {
    const name = displayName.trim();
    if (!name) {
      toastError('Name is required.');
      return;
    }

    if (channel === 'email') {
      if (!email.trim()) {
        toastError('Email is required for email channel.');
        return;
      }
      const body = {
        display_name: name,
        channel: 'email' as const,
        email: email.trim(),
        phone_e164: null as string | null,
      };
      if (editingId) {
        updateMutation.mutate({ id: editingId, body });
      } else {
        createMutation.mutate({
          display_name: name,
          channel: 'email',
          email: email.trim(),
        });
      }
      return;
    }

    if (!phone.trim().startsWith('+')) {
      toastError('Phone must start with + (E.164).');
      return;
    } const body = {
      display_name: name,
      channel,
      phone_e164: phone.trim(),
      email: null as string | null,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, body });
    } else {
      createMutation.mutate({
        display_name: name,
        channel,
        phone_e164: phone.trim(),
      });
    }
  };

  return (
    <View className="gap-3">
      <Text className="text-lg font-bold text-neutral-900 dark:text-white">
        Friends & family alerts
      </Text>
      <Text className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        Save people you may message in an emergency — SMS, WhatsApp, or email. They must agree before you
        contact them; sending is rate-limited per day.
      </Text>
      {limitsLine ? <Banner message={limitsLine} tone="info" /> : null}

      <FeatureSection accent={AccountSectionAccent.contactForm}>
        <Text className="mb-2 text-sm font-semibold text-neutral-900 dark:text-white">
          {isEditing ? 'Edit contact' : 'Add contact'}
        </Text>
        <AuthTextField
          label="Name"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          placeholder="Relative or colleague"
        />
        <ChipMultiSelect
          label="Channel"
          options={CHANNEL_OPTIONS}
          selected={[channel]}
          onChange={(next) =>
            setChannel((next[0] as SharedContactChannel) || channel)
          }
          single
        />
        {channel === 'email' ? (
          <AuthTextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="name@example.com"
          />
        ) : (
          <AuthTextField
            label="Phone (E.164)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="+977..."
            help="Include country code"
          />
        )}
        <View className="gap-2">
          <PrimaryButton
            label={
              saving
                ? isEditing
                  ? 'Saving…'
                  : 'Adding…'
                : isEditing
                  ? 'Save changes'
                  : 'Add contact'
            }
            disabled={saving}
            onPress={onSubmit}
          />
          {isEditing ? (
            <PrimaryButton label="Cancel edit" variant="ghost" onPress={resetForm} />
          ) : null}
        </View>
      </FeatureSection>

      <FeatureSection accent={AccountSectionAccent.contactList}>
        <Text className="mb-2 text-sm font-semibold text-neutral-900 dark:text-white">
          Saved contacts
        </Text>
        {listQuery.isLoading ? (
          <Text className="text-sm text-neutral-500">Loading…</Text>
        ) : contacts.length === 0 ? (
          <Text className="text-sm text-neutral-500">No contacts saved yet.</Text>
        ) : (
          <>
            {contacts.map((c) => {
              const selected = selectedIds.includes(c.id);
              const rowEditing = editingId === c.id;
              return (
                <View
                  key={c.id}
                  className={`flex-row items-center border-b border-neutral-100 py-3 dark:border-neutral-800 ${rowEditing ? 'bg-blue-50/60 dark:bg-blue-950/40' : ''
                    }`}>
                  <Pressable
                    onPress={() => toggleSelected(c.id)}
                    className="min-w-0 flex-1 flex-row items-start gap-3"
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}>
                    <View
                      className={
                        selected
                          ? 'mt-0.5 h-5 w-5 items-center justify-center rounded bg-secondary'
                          : 'mt-0.5 h-5 w-5 rounded border border-neutral-400'
                      }>
                      {selected ? <Text className="text-xs font-bold text-white">✓</Text> : null}
                    </View>
                    <View className="min-w-0 flex-1 pr-2">
                      <Text className="text-sm font-semibold text-neutral-900 dark:text-white">
                        {c.display_name}
                        {rowEditing ? ' · editing' : ''}
                      </Text>
                      <Text className="text-xs text-neutral-500">
                        {c.channel}
                        {c.phone_e164 ? ` · ${c.phone_e164}` : ''}
                        {c.email ? ` · ${c.email}` : ''}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => startEdit(c)}
                    disabled={saving || deleting}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${c.display_name}`}
                    className="ml-1 h-9 w-9 items-center justify-center rounded-lg border border-secondary/40 active:bg-blue-50 dark:active:bg-blue-950"
                    style={saving || deleting ? { opacity: 0.45 } : undefined}>
                    <EditIcon />
                  </Pressable>
                  <Pressable
                    onPress={() => deleteMutation.mutate(c.id)}
                    disabled={deleting}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${c.display_name}`}
                    className="ml-1 h-9 w-9 items-center justify-center rounded-lg border border-primary/30 active:bg-red-50 dark:active:bg-red-950"
                    style={deleting ? { opacity: 0.45 } : undefined}>
                    {deleteMutation.isPending && deleteMutation.variables === c.id ? (
                      <ActivityIndicator size="small" color={BrandColors.primary} />
                    ) : (
                      <TrashIcon />
                    )}
                  </Pressable>
                </View>
              );
            })}
          </>
        )}
      </FeatureSection>

      <FeatureSection accent={AccountSectionAccent.sendAlert}>
        <Text className="mb-2 text-sm font-semibold text-neutral-900 dark:text-white">
          Send now
        </Text>
        <AuthTextField
          label="Message"
          value={message}
          onChangeText={setMessage}
          multiline
          placeholder="Short alert for selected contacts (max 1200 chars)"
        />
        <ConsentToggle
          label="I confirm these recipients agreed to be contacted this way."
          checked={consented}
          onChange={setConsented}
        />
        <PrimaryButton
          label={notifyMutation.isPending ? 'Sending…' : 'Send to selected'}
          disabled={
            notifyMutation.isPending ||
            !consented ||
            selectedIds.length === 0 ||
            message.trim().length < 2
          }
          onPress={() =>
            notifyMutation.mutate({
              contact_ids: selectedIds,
              message: message.trim().slice(0, 1200),
              confirm_recipients_consented: true,
            })
          }
        />
      </FeatureSection>
    </View>
  );
}
