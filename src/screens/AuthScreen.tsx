import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, ScrollView, Platform, Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signIn, signUp, resetPassword } from '../lib/auth';
import { containsProfanity } from '../utils/profanityFilter';
import { checkReferralCode, normalizeCode } from '../lib/referral';
import { PixelCorner } from '../components/PixelCorner';
import { CountryPicker } from '../components/CountryPicker';
import { flagEmoji, findCountry } from '../constants/countries';
import { FONTS, SPACING, RADIUS } from '../constants/theme';
import { useAuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../constants/appearances';

type Mode = 'login' | 'register';

// ─── Field styles factory ─────────────────────────────────────────────────────

function createFieldStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    wrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.md,
      height: 52,
    },
    icon: { marginRight: SPACING.sm },
    input: {
      flex: 1,
      color: colors.text,
      fontSize: FONTS.size.md,
      height: '100%',
    },
  });
}

// ─── Field component ──────────────────────────────────────────────────────────

interface FieldProps {
  icon: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words';
  maxLength?: number;
  rightElement?: React.ReactNode;
}

function Field({ icon, placeholder, value, onChangeText, secureTextEntry, keyboardType, autoCapitalize, maxLength, rightElement }: FieldProps) {
  const { colors, fontFamily } = useTheme();
  const field = useMemo(() => createFieldStyles(colors, fontFamily), [colors, fontFamily]);

  return (
    <View style={field.wrapper}>
      <Ionicons name={icon as any} size={17} color={colors.textMuted} style={field.icon} />
      <TextInput
        style={field.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'none'}
        autoCorrect={false}
        maxLength={maxLength}
      />
      {rightElement}
    </View>
  );
}

// ─── Main styles factory ──────────────────────────────────────────────────────

const CORNER = 20;

function createStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.xxl * 2,
      gap: SPACING.xl,
    },
    cornerTL: { position: 'absolute', top: CORNER, left: CORNER },
    cornerTR: { position: 'absolute', top: CORNER, right: CORNER },
    cornerBL: { position: 'absolute', bottom: CORNER, left: CORNER },
    cornerBR: { position: 'absolute', bottom: CORNER, right: CORNER },

    // Logo
    logoRow: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.xs },
    logoPIXEL: {
      color: colors.text, fontSize: 38, fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace', letterSpacing: 6,
    },
    logoNIGHT: {
      color: colors.accent, fontSize: 38, fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace', letterSpacing: 6,
    },
    tagline: {
      color: colors.textMuted, fontSize: FONTS.size.xs,
      fontFamily: ff ?? 'monospace', letterSpacing: 2, textAlign: 'center',
    },

    // Tab switcher
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.sm,
      overflow: 'hidden',
      width: '100%',
    },
    tabBtn: { flex: 1, paddingVertical: SPACING.md, alignItems: 'center' },
    tabBtnActive: { backgroundColor: colors.accent },
    tabLabel: { color: colors.textMuted, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold, fontFamily: ff ?? 'monospace', letterSpacing: 1 },
    tabLabelActive: { color: colors.text },

    // Form
    form: { width: '100%', gap: SPACING.md },

    // Error / success
    errorBox: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      backgroundColor: colors.accentDim, borderRadius: RADIUS.sm,
      borderWidth: 1, borderColor: colors.accent,
      padding: SPACING.sm,
    },
    errorText: { color: colors.accent, fontSize: FONTS.size.sm, flex: 1 },
    successBox: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      backgroundColor: colors.successDim, borderRadius: RADIUS.sm,
      borderWidth: 1, borderColor: colors.success,
      padding: SPACING.sm,
    },
    successText: { color: colors.success, fontSize: FONTS.size.sm, flex: 1 },

    // Submit button
    submitBtn: {
      backgroundColor: colors.accent, borderRadius: 2, paddingVertical: SPACING.lg,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: '#ff6b85',
      borderBottomColor: '#9e1a2e', borderRightColor: '#9e1a2e',
      marginTop: SPACING.xs,
    },
    btnDot: { position: 'absolute', width: 5, height: 5, backgroundColor: colors.background },
    submitText: {
      color: colors.text, fontSize: FONTS.size.md, fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace', letterSpacing: 3,
    },

    // Sélecteur pays
    countryBtn: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border,
      borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, height: 52,
    },
    countryFlag: { fontSize: 20 },
    countryName: { flex: 1, color: colors.text, fontSize: FONTS.size.md },
    countryChevron: {},

    forgotBtn: { alignItems: 'center', paddingVertical: SPACING.sm },
    forgotText: { color: colors.textMuted, fontSize: FONTS.size.sm, textDecorationLine: 'underline' },
    disclaimer: { color: colors.textMuted, fontSize: FONTS.size.xs, textAlign: 'center', lineHeight: 18 },

    // Parrainage
    referralWrapper: {
      flexDirection: 'row',
      alignItems:    'center',
      backgroundColor: colors.card,
      borderWidth:   1.5,
      borderColor:   colors.border,
      borderRadius:  RADIUS.sm,
      paddingHorizontal: SPACING.md,
      height: 52,
    },
    referralWrapperOk: { borderColor: colors.success },
    referralInput: {
      flex: 1,
      color: colors.text,
      fontSize: FONTS.size.md,
      height: '100%',
      letterSpacing: 3,
    },
    referralCheckIcon: { marginLeft: SPACING.xs },
    referralHint: {
      color:      colors.textMuted,
      fontSize:   FONTS.size.xs,
      marginTop:  -SPACING.xs,
      lineHeight: 16,
    },
    referralBonus: {
      flexDirection:  'row',
      alignItems:     'center',
      gap:            SPACING.xs,
      backgroundColor: colors.successDim,
      borderRadius:   RADIUS.sm,
      borderWidth:    1,
      borderColor:    colors.success,
      paddingVertical: SPACING.xs,
      paddingHorizontal: SPACING.sm,
      marginTop: -SPACING.xs,
    },
    referralBonusText: {
      color:      colors.success,
      fontSize:   FONTS.size.xs,
      fontWeight: FONTS.weight.bold,
      flex: 1,
    },

    // Séparateur "ou"
    divider: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, width: '100%' },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { color: colors.textMuted, fontSize: FONTS.size.xs },

    // Bouton invité
    guestBtn: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.sm, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.card, width: '100%', justifyContent: 'center',
    },
    guestText: {
      color: colors.textMuted, fontSize: FONTS.size.sm,
      fontWeight: FONTS.weight.medium, flex: 1, textAlign: 'center',
    },
    guestNote: {
      color: colors.textMuted, fontSize: 10, textAlign: 'center',
      opacity: 0.7, lineHeight: 14,
    },
  });
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function AuthScreen() {
  const { continueAsGuest } = useAuthContext();
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);

  const [mode, setMode]               = useState<Mode>('login');
  const [pseudo, setPseudo]           = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [countryCode, setCountryCode] = useState('FR');
  const [showCountry, setShowCountry] = useState(false);
  const [showPwd, setShowPwd]         = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [resetSent, setResetSent]     = useState(false);

  // ── Parrainage ────────────────────────────────────────────────────────────
  const [referralCode,       setReferralCode]       = useState('');
  const [referralValid,      setReferralValid]      = useState<boolean | null>(null); // null=non vérifié
  const [referralChecking,   setReferralChecking]   = useState(false);
  const referralTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const switchMode = useCallback((next: Mode) => {
    if (next === mode) return;
    setError('');
    setResetSent(false);
    setReferralCode('');
    setReferralValid(null);
    Animated.timing(slideAnim, { toValue: next === 'register' ? 1 : 0, duration: 220, useNativeDriver: true }).start();
    setMode(next);
  }, [mode, slideAnim]);

  // ── Vérification du code de parrainage (debounce 600ms) ──────────────────
  const handleReferralChange = useCallback((raw: string) => {
    const value = raw.toUpperCase().replace(/[^A-Z2-9]/g, '');
    setReferralCode(value);
    setReferralValid(null);

    if (referralTimer.current) clearTimeout(referralTimer.current);
    if (value.length < 8) return;

    setReferralChecking(true);
    referralTimer.current = setTimeout(async () => {
      const referrerId = await checkReferralCode(value);
      setReferralChecking(false);
      setReferralValid(referrerId !== null);
    }, 600);
  }, []);

  const handleSubmit = useCallback(async () => {
    setError('');
    const trimEmail  = email.trim();
    const trimPseudo = pseudo.trim();

    if (!trimEmail || !password) { setError('Email et mot de passe requis.'); return; }
    if (mode === 'register' && trimPseudo.length < 3) { setError('Le pseudo doit faire au moins 3 caractères.'); return; }
    if (mode === 'register' && containsProfanity(trimPseudo)) { setError('Pseudo non autorisé, choisis un autre pseudo.'); return; }
    if (password.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères.'); return; }

    // Bloque si le code de parrainage a été saisi mais est invalide
    if (mode === 'register' && referralCode.length > 0 && referralValid === false) {
      setError('Code de parrainage invalide — laisse le champ vide pour continuer sans.');
      return;
    }
    // Bloque si la vérification est encore en cours
    if (mode === 'register' && referralChecking) {
      setError('Vérification du code en cours, attends un instant…');
      return;
    }

    setLoading(true);
    const trimReferral = normalizeCode(referralCode);
    const err = mode === 'login'
      ? await signIn(trimEmail, password)
      : await signUp(
          trimEmail, password, trimPseudo, countryCode,
          trimReferral.length === 8 && referralValid ? trimReferral : undefined,
        );
    setLoading(false);

    if (err) {
      setError(err.message);
    }
    // On success, AuthContext.onAuthStateChange fires → App re-renders
  }, [mode, email, password, pseudo, countryCode, referralCode, referralValid, referralChecking]);

  const handleReset = useCallback(async () => {
    if (!email.trim()) { setError('Entrez votre email pour réinitialiser.'); return; }
    setLoading(true);
    const err = await resetPassword(email.trim());
    setLoading(false);
    if (err) { setError(err.message); } else { setResetSent(true); setError(''); }
  }, [email]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Pixel corners */}
      <View style={styles.cornerTL}><PixelCorner position="tl" size={28} /></View>
      <View style={styles.cornerTR}><PixelCorner position="tr" size={28} /></View>
      <View style={styles.cornerBL}><PixelCorner position="bl" size={28} /></View>
      <View style={styles.cornerBR}><PixelCorner position="br" size={28} /></View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoRow}>
          <Text style={styles.logoPIXEL}>PIXEL</Text>
          <Text style={styles.logoNIGHT}>NIGHT</Text>
        </View>
        <Text style={styles.tagline}>CRÉE TON COMPTE · JOUE · GRIMPE</Text>

        {/* Tab switcher */}
        <View style={styles.tabBar}>
          {(['login', 'register'] as Mode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.tabBtn, mode === m && styles.tabBtnActive]}
              onPress={() => switchMode(m)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabLabel, mode === m && styles.tabLabelActive]}>
                {m === 'login' ? 'CONNEXION' : 'INSCRIPTION'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Pseudo — register only */}
          {mode === 'register' && (
            <Field
              icon="person-outline"
              placeholder="Pseudo (min. 3 caractères)"
              value={pseudo}
              onChangeText={setPseudo}
              autoCapitalize="words"
              maxLength={20}
            />
          )}

          {/* Pays — register only */}
          {mode === 'register' && (
            <TouchableOpacity
              style={styles.countryBtn}
              onPress={() => setShowCountry(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="globe-outline" size={17} color={colors.textMuted} />
              <Text style={styles.countryFlag}>{flagEmoji(countryCode)}</Text>
              <Text style={styles.countryName}>{findCountry(countryCode).name}</Text>
              <Ionicons name="chevron-down" size={15} color={colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* Code de parrainage — register only */}
          {mode === 'register' && (
            <>
              <View style={[
                styles.referralWrapper,
                referralValid === true && styles.referralWrapperOk,
              ]}>
                <Ionicons name="gift-outline" size={17} color={colors.textMuted} style={{ marginRight: SPACING.sm }} />
                <TextInput
                  style={styles.referralInput}
                  value={referralCode}
                  onChangeText={handleReferralChange}
                  placeholder="Code de parrainage (facultatif)"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={8}
                />
                {referralChecking && (
                  <ActivityIndicator size="small" color={colors.textMuted} style={styles.referralCheckIcon} />
                )}
                {!referralChecking && referralCode.length === 8 && referralValid === true && (
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} style={styles.referralCheckIcon} />
                )}
                {!referralChecking && referralCode.length === 8 && referralValid === false && (
                  <Ionicons name="close-circle" size={18} color={colors.accent} style={styles.referralCheckIcon} />
                )}
              </View>

              {referralValid === true && (
                <View style={styles.referralBonus}>
                  <Ionicons name="gift" size={14} color={colors.success} />
                  <Text style={styles.referralBonusText}>
                    Code valide ! Vous recevrez 50 pièces à l'inscription 🎁
                  </Text>
                </View>
              )}
              {referralCode.length > 0 && referralCode.length < 8 && (
                <Text style={styles.referralHint}>
                  Le code fait 8 caractères ({referralCode.length}/8)
                </Text>
              )}
            </>
          )}

          <Field
            icon="mail-outline"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />

          <Field
            icon="lock-closed-outline"
            placeholder="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPwd}
            rightElement={
              <TouchableOpacity onPress={() => setShowPwd((v) => !v)} style={{ padding: 4 }}>
                <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
            }
          />

          {/* Error */}
          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color={colors.accent} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Reset sent */}
          {resetSent && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle-outline" size={15} color={colors.success} />
              <Text style={styles.successText}>Email de réinitialisation envoyé !</Text>
            </View>
          )}

          {/* Submit button */}
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
            {loading
              ? <ActivityIndicator color={colors.text} />
              : <Text style={styles.submitText}>{mode === 'login' ? 'SE CONNECTER' : 'CRÉER MON COMPTE'}</Text>
            }
            {/* Pixel corner dots */}
            <View style={[styles.btnDot, { top: 0, left: 0 }]} />
            <View style={[styles.btnDot, { top: 0, right: 0 }]} />
            <View style={[styles.btnDot, { bottom: 0, left: 0 }]} />
            <View style={[styles.btnDot, { bottom: 0, right: 0 }]} />
          </TouchableOpacity>

          {/* Forgot password — login only */}
          {mode === 'login' && (
            <TouchableOpacity style={styles.forgotBtn} onPress={handleReset} disabled={loading}>
              <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          )}

          {/* Register disclaimer */}
          {mode === 'register' && (
            <Text style={styles.disclaimer}>
              Ton pseudo sera visible dans le classement mondial.
            </Text>
          )}
        </View>

        {/* ── Séparateur ───────────────────────────────────────────── */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* ── Mode invité ──────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.guestBtn}
          onPress={continueAsGuest}
          activeOpacity={0.7}
        >
          <Ionicons name="person-outline" size={15} color={colors.textMuted} />
          <Text style={styles.guestText}>Continuer sans compte</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
        </TouchableOpacity>
        <Text style={styles.guestNote}>
          Stats sauvegardées localement · Pas de classement mondial
        </Text>

      </ScrollView>

      <CountryPicker
        visible={showCountry}
        selected={countryCode}
        onSelect={setCountryCode}
        onClose={() => setShowCountry(false)}
      />
    </KeyboardAvoidingView>
  );
}
