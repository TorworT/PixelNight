/**
 * avatarStorage.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Upload de photo de profil vers Supabase Storage via FormData + fetch.
 *
 * Pourquoi pas expo-file-system ni fetch().blob() ?
 *   • fetch(localUri).blob() lève "Network request failed" sur Android/Hermes
 *     car le networking layer ne route pas les URIs locales (file://, content://).
 *   • expo-file-system.readAsStringAsync lève "Cannot read property 'Base64'
 *     of undefined" sur certaines versions de Hermes (EncodingType non exporté).
 *
 * Solution retenue :
 *   FormData avec l'objet { uri, name, type } que React Native sait sérialiser
 *   nativement, uploadé via fetch() vers l'API REST de Supabase Storage
 *   (pas le SDK JS, qui passerait par ArrayBuffer ou Blob).
 *
 * Prérequis Supabase (à exécuter dans le Dashboard > SQL Editor) :
 * ─────────────────────────────────────────────────────────────────
 *   -- 1. Créer le bucket (ou via Dashboard > Storage > New bucket)
 *   INSERT INTO storage.buckets (id, name, public)
 *   VALUES ('avatars', 'avatars', true)
 *   ON CONFLICT DO NOTHING;
 *
 *   -- 2. Lecture publique
 *   CREATE POLICY "avatars_public_read" ON storage.objects
 *     FOR SELECT TO public
 *     USING (bucket_id = 'avatars');
 *
 *   -- 3. Upload dans son propre dossier (userId/)
 *   CREATE POLICY "avatars_auth_insert" ON storage.objects
 *     FOR INSERT TO authenticated
 *     WITH CHECK (
 *       bucket_id = 'avatars'
 *       AND (storage.foldername(name))[1] = auth.uid()::text
 *     );
 *
 *   -- 4. Mise à jour de son propre avatar
 *   CREATE POLICY "avatars_auth_update" ON storage.objects
 *     FOR UPDATE TO authenticated
 *     USING (
 *       bucket_id = 'avatars'
 *       AND (storage.foldername(name))[1] = auth.uid()::text
 *     );
 */

import * as ImagePicker from 'expo-image-picker';
import { supabase }     from './supabase';

// URL hardcodée pour l'appel REST direct (même valeur que dans supabase.ts)
const SUPABASE_URL = 'https://dbxrixboueetuditoxdz.supabase.co';

// ─── Upload principal ─────────────────────────────────────────────────────────

/**
 * Ouvre la galerie, laisse le joueur rogner l'image en carré (1:1),
 * uploade dans `avatars/{userId}/avatar.jpg` via FormData,
 * met à jour profiles.avatar_url et retourne la nouvelle URL publique.
 *
 * Retourne null si l'utilisateur annule.
 * Lève une Error avec un message détaillé si l'upload échoue.
 */
export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  console.log('[avatarStorage] ── start ──', { userId });

  // ── 1. Permission ──────────────────────────────────────────────────────────
  const { granted, status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  console.log('[avatarStorage] permission →', { status, granted });
  if (!granted) {
    console.warn('[avatarStorage] permission denied');
    return null;
  }

  // ── 2. Sélection image ─────────────────────────────────────────────────────
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes:    ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect:        [1, 1] as [number, number],
    quality:       0.80,
  });

  if (picked.canceled || !picked.assets?.length) {
    console.log('[avatarStorage] cancelled');
    return null;
  }

  const asset = picked.assets[0];
  const uri   = asset.uri;
  console.log('[avatarStorage] asset →', {
    uri,
    width:    asset.width,
    height:   asset.height,
    fileSize: asset.fileSize,
    type:     asset.type,
  });

  // ── 3. Vérification session ────────────────────────────────────────────────
  const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
  console.log('[avatarStorage] session →', {
    exists: !!session,
    userId: session?.user?.id,
    error:  sessionErr?.message,
  });
  if (!session) throw new Error('[avatarStorage] no_session — user not authenticated');

  // ── 4. Chemin stable par userId ────────────────────────────────────────────
  // On écrase toujours le même fichier : pas d'accumulation dans le bucket
  const filePath  = `${userId}/avatar.jpg`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/avatars/${filePath}`;
  console.log('[avatarStorage] upload params →', { filePath, uploadUrl });

  // ── 5. FormData ────────────────────────────────────────────────────────────
  // React Native sait sérialiser { uri, name, type } nativement sans lire
  // le fichier en mémoire, ce qui fonctionne sur Android comme sur iOS.
  const formData = new FormData();
  formData.append('file', {
    uri,
    name: 'avatar.jpg',
    type: 'image/jpeg',
  } as any);

  // ── 6. Upload via fetch REST ───────────────────────────────────────────────
  console.log('[avatarStorage] fetching upload URL...');
  let response: Response;
  try {
    response = await fetch(uploadUrl, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'x-upsert':      'true',   // crée ou écrase le fichier existant
      },
      body: formData,
    });
  } catch (fetchErr: any) {
    console.error('[avatarStorage] fetch FAILED →', fetchErr?.message ?? fetchErr);
    throw new Error(`[avatarStorage] fetch_failed: ${fetchErr?.message}`);
  }

  console.log('[avatarStorage] response status →', response.status);

  if (!response.ok) {
    let errorBody = '';
    try { errorBody = await response.text(); } catch { /* ignore */ }
    console.error('[avatarStorage] upload FAILED →', { status: response.status, body: errorBody });

    // Diagnostic selon le code HTTP
    if (response.status === 404) {
      throw new Error('[avatarStorage] bucket "avatars" introuvable — crée-le dans le Dashboard Supabase');
    }
    if (response.status === 403) {
      throw new Error('[avatarStorage] accès refusé — vérifie les policies RLS du bucket "avatars"');
    }
    throw new Error(`[avatarStorage] upload_failed (${response.status}): ${errorBody}`);
  }

  console.log('[avatarStorage] upload OK');

  // ── 7. URL publique ────────────────────────────────────────────────────────
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
  // Cache-buster pour que React Native recharge l'image immédiatement
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
  console.log('[avatarStorage] publicUrl →', publicUrl);

  if (!publicUrl.startsWith('https://')) {
    throw new Error(`[avatarStorage] url_invalid: "${publicUrl}"`);
  }

  // ── 8. Mise à jour profiles.avatar_url ────────────────────────────────────
  console.log('[avatarStorage] updating profiles.avatar_url...');
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId);

  if (updateError) {
    console.error('[avatarStorage] profile update FAILED →', {
      message: updateError.message,
      code:    (updateError as any).code,
    });
    throw new Error(`[avatarStorage] profile_update_failed: ${updateError.message}`);
  }

  console.log('[avatarStorage] ── done ──', publicUrl);
  return publicUrl;
}
