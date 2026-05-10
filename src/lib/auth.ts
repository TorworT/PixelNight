import { supabase } from './supabase';

export interface AuthError {
  message: string;
}

// ─── Sign up ──────────────────────────────────────────────────────────────────

export async function signUp(
  email: string,
  password: string,
  pseudo: string,
  countryCode: string = 'FR',
  referralCode?: string,
): Promise<AuthError | null> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      // raw_user_meta_data → lue par le trigger handle_new_user → table profiles
      data: {
        pseudo:        pseudo.trim(),
        country_code:  countryCode,
        // Passé uniquement si fourni — le trigger l'ignore si vide
        ...(referralCode ? { referral_code: referralCode.trim().toUpperCase() } : {}),
      },
    },
  });
  if (error) return { message: friendly(error.message) };

  // Mise à jour directe en fallback (si le trigger ne lit pas encore country_code)
  if (data.user) {
    await supabase
      .from('profiles')
      .update({ country_code: countryCode })
      .eq('id', data.user.id)
      .then(() => {})   // résultat ignoré volontairement
      .catch(() => {});
  }
  return null;
}

// ─── Sign in ──────────────────────────────────────────────────────────────────

export async function signIn(
  email: string,
  password: string,
): Promise<AuthError | null> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  return error ? { message: friendly(error.message) } : null;
}

// ─── Sign out ─────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// ─── Password reset ───────────────────────────────────────────────────────────

export async function resetPassword(email: string): Promise<AuthError | null> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  return error ? { message: friendly(error.message) } : null;
}

// ─── Error messages FR ────────────────────────────────────────────────────────

function friendly(msg: string): string {
  if (msg.includes('Invalid login credentials'))   return 'Email ou mot de passe incorrect.';
  if (msg.includes('User already registered'))      return 'Cet email est déjà utilisé.';
  if (msg.includes('Password should be'))           return 'Le mot de passe doit faire au moins 6 caractères.';
  if (msg.includes('Unable to validate email'))     return 'Adresse email invalide.';
  if (msg.includes('Email not confirmed'))          return 'Confirmez votre email avant de vous connecter.';
  if (msg.includes('rate limit'))                   return 'Trop de tentatives. Réessayez dans un moment.';
  return msg;
}
