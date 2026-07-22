import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  AuthTextField,
  Banner,
  ChipMultiSelect,
  ConsentToggle,
  PrimaryButton,
} from '@/features/auth/FormFields';
import { useSharedContacts } from '@/hooks/useAuth';
import {
  createSharedContact,
  deleteSharedContact,
  notifySharedContacts,
} from '@/services/api/auth';
import { toApiError } from '@/services/api/client';

import type { SharedContactChannel } from '@/types/auth';

const CHANNEL_OPTIONS = [
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
];

export function FriendsFamilyPanel() {
  const queryClient = useQueryClient();
  const listQuery = useSharedContacts(true);

  const [displayName, setDisplayName] = useState('');
  const [channel, setChannel] = useState<SharedContactChannel>('sms');
  const [phone, setPhone] = useState('+977');
  const [email, setEmail] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [consented, setConsented] = useState(false);
  const [banner, setBanner] = useState<{ message: string; tone: 'info' | 'error' | 'success' } | null>(
    null,
  );

  const contacts = listQuery.data?.contacts ?? [];
  const limits = listQuery.data?.limits;

  const limitsLine = useMemo(() => {
    if (!limits) return null;
    return `You can store up to ${limits.max_contacts} contacts. Friend/family sends: ${limits.notify_recipients_sent_today} / ${limits.notify_recipients_daily_max} recipients used today (UTC).`;
  }, [limits]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['auth', 'shared-contacts'] });
  };

  const createMutation = useMutation({
    mutationFn: createSharedContact,
    onSuccess: async () => {
      setBanner({ message: 'Contact saved.', tone: 'success' });
      setDisplayName('');
      setPhone('+977');
      setEmail('');
      await invalidate();
    },
    onError: (error) => setBanner({ message: toApiError(error).message, tone: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSharedContact,
    onSuccess: async (_data, id) => {
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      setBanner({ message: 'Contact removed.', tone: 'success' });
      await invalidate();
    },
    onError: (error) => setBanner({ message: toApiError(error).message, tone: 'error' }),
  });

  const notifyMutation = useMutation({
    mutationFn: notifySharedContacts,
    onSuccess: async (data) => {
      const ok = data.results?.filter((r) => r.ok).length ?? 0;
      const fail = data.results?.filter((r) => !r.ok).length ?? 0;
      setBanner({
        message: `Sent to ${ok} contact(s)${fail ? `, ${fail} failed` : ''}.`,
        tone: fail ? 'info' : 'success',
      });
      setMessage('');
      setConsented(false);
      await invalidate();
    },
    onError: (error) => setBanner({ message: toApiError(error).message, tone: 'error' }),
  });

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const onAdd = () => {
    const name = displayName.trim();
    if (!name) {
      setBanner({ message: 'Name is required.', tone: 'error' });
      return;
    }
    if (channel === 'email') {
      if (!email.trim()) {
        setBanner({ message: 'Email is required for email channel.', tone: 'error' });
        return;
      }
      createMutation.mutate({
        display_name: name,
        channel: 'email',
        email: email.trim(),
      });
      return;
    }
    if (!phone.trim().startsWith('+')) {
      setBanner({ message: 'Phone must start with + (E.164).', tone: 'error' });
      return;
    }
    createMutation.mutate({
      display_name: name,
      channel,
      phone_e164: phone.trim(),
    });
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
      {banner ? <Banner message={banner.message} tone={banner.tone} /> : null}

      <View className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <Text className="mb-2 text-sm font-semibold text-neutral-900 dark:text-white">
          Add contact
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
        <PrimaryButton
          label={createMutation.isPending ? 'Saving…' : 'Add contact'}
          disabled={createMutation.isPending}
          onPress={onAdd}
        />
      </View>

      <View className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <Text className="mb-2 text-sm font-semibold text-neutral-900 dark:text-white">
          Saved contacts
        </Text>
        {listQuery.isLoading ? (
          <Text className="text-sm text-neutral-500">Loading…</Text>
        ) : contacts.length === 0 ? (
          <Text className="text-sm text-neutral-500">No contacts saved yet.</Text>
        ) : (
          contacts.map((c) => {
            const selected = selectedIds.includes(c.id);
            return (
              <View
                key={c.id}
                className="border-b border-neutral-100 py-3 dark:border-neutral-800">
                <Pressable onPress={() => toggleSelected(c.id)} className="flex-row items-start gap-3">
                  <View
                    className={
                      selected
                        ? 'mt-0.5 h-5 w-5 items-center justify-center rounded bg-primary'
                        : 'mt-0.5 h-5 w-5 rounded border border-neutral-400'
                    }>
                    {selected ? <Text className="text-xs font-bold text-white">✓</Text> : null}
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-neutral-900 dark:text-white">
                      {c.display_name}
                    </Text>
                    <Text className="text-xs text-neutral-500">
                      {c.channel}
                      {c.phone_e164 ? ` · ${c.phone_e164}` : ''}
                      {c.email ? ` · ${c.email}` : ''}
                    </Text>
                  </View>
                </Pressable>
                <PrimaryButton
                  label="Remove"
                  variant="dangerOutline"
                  onPress={() => deleteMutation.mutate(c.id)}
                />
              </View>
            );
          })
        )}
      </View>

      <View className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
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
      </View>
    </View>
  );
}
