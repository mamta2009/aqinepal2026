import AsyncStorage from "@react-native-async-storage/async-storage";

/** Mirrors web sessionStorage keys from registration_portal.html until verify succeeds. */
const REG_EMAIL_KEY = "ew_reg_email";
const REG_CONTACT_ID_KEY = "ew_reg_contact_id";

export async function savePendingRegistration(
  email: string,
  contactId: string,
): Promise<void> {
  await AsyncStorage.multiSet([
    [REG_EMAIL_KEY, email],
    [REG_CONTACT_ID_KEY, contactId],
  ]);
}

export async function loadPendingRegistration(): Promise<{
  email: string | null;
  contactId: string | null;
}> {
  const pairs = await AsyncStorage.multiGet([
    REG_EMAIL_KEY,
    REG_CONTACT_ID_KEY,
  ]);
  const map = Object.fromEntries(pairs);
  return {
    email: map[REG_EMAIL_KEY] ?? null,
    contactId: map[REG_CONTACT_ID_KEY] ?? null,
  };
}

export async function clearPendingRegistration(): Promise<void> {
  await AsyncStorage.multiRemove([REG_EMAIL_KEY, REG_CONTACT_ID_KEY]);
}
