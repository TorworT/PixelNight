import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dbxrixboueetuditoxdz.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRieHJpeGJvdWVldHVkaXRveGR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjkzNzMsImV4cCI6MjA5MTg0NTM3M30.' +
  'kMFwNFBplSdz-l5mlcfWE0ovq0e6Bs_17C8RoVMT1ns';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export interface DailyGameRow {
  id: string;
  date: string;
  game_name: string;
  category: string;
  image_url: string;
  hint1: string;
  hint2: string;
  hint3: string;
  aliases: string[]; // ✅ ajout
  created_at: string;
}

export function resolveImageUrl(imageUrl: string, folder = 'games'): string {
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  const cleanPath = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
  return `${SUPABASE_URL}/storage/v1/object/public/${folder}/${cleanPath}`;
}