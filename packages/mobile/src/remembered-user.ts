import * as SecureStore from 'expo-secure-store';

const REMEMBERED_EMAIL = 'luma.rememberedEmail';

/** El correo que la persona pidió dejar escrito. Nunca la contraseña. */
export async function loadRememberedEmail(): Promise<string | null> {
  const email = await SecureStore.getItemAsync(REMEMBERED_EMAIL);
  const trimmed = email?.trim();
  return trimmed ? trimmed : null;
}

export async function saveRememberedEmail(email: string): Promise<void> {
  await SecureStore.setItemAsync(REMEMBERED_EMAIL, email.trim());
}

export async function clearRememberedEmail(): Promise<void> {
  await SecureStore.deleteItemAsync(REMEMBERED_EMAIL);
}
