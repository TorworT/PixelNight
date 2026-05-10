/**
 * SupportModal — Formulaire de contact PixelNight.
 *
 * Ouvre l'app mail native du téléphone via Linking avec les champs
 * pré-remplis (sujet, corps structuré).
 *
 * L'email du joueur est pré-chargé depuis useAuthContext.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from '../context/AuthContext';
import type { ThemeColors } from '../constants/appearances';

// ─── Catégories de support ────────────────────────────────────────────────────

interface SupportCategory {
  id:    string;
  emoji: string;
  label: string;
}

const SUPPORT_CATS: SupportCategory[] = [
  { id: 'games',   emoji: '🎮', label: 'Jeux Vidéo' },
  { id: 'cinema',  emoji: '🎬', label: 'Cinéma' },
  { id: 'anime',   emoji: '⭐', label: 'Animé' },
  { id: 'shop',    emoji: '🛒', label: 'Boutique' },
  { id: 'rank',    emoji: '🏆', label: 'Classement' },
  { id: 'profile', emoji: '👤', label: 'Profil' },
  { id: 'improvement', emoji: '💡', label: 'Amélioration du jeu' },
  { id: 'other',       emoji: '🔧', label: 'Autre' },
];

const SUPPORT_EMAIL = 'PixelNight04@gmail.com';
const APP_VERSION   = '1.0.2';
const MIN_LENGTH    = 20;

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    // Overlay
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.87)',
    },
    sheet: {
      flex: 1,
      marginTop: 48,
      backgroundColor: colors.background,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      overflow: 'hidden',
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
      gap: SPACING.sm,
    },
    headerLogo: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 3,
      flex: 1,
    },
    headerPIXEL: {
      color: colors.text,
      fontSize: FONTS.size.md,
      fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace',
      letterSpacing: 2,
    },
    headerNIGHT: {
      color: colors.accent,
      fontSize: FONTS.size.md,
      fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace',
      letterSpacing: 2,
    },
    headerSub: {
      color: colors.textMuted,
      fontSize: FONTS.size.xs,
    },
    closeBtn: { padding: SPACING.xs },

    // Scroll content
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.xl,
      paddingBottom: SPACING.xxl * 2,
      gap: SPACING.lg,
    },

    // Section label
    label: {
      color: colors.textMuted,
      fontSize: FONTS.size.xs,
      fontWeight: FONTS.weight.bold,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: -SPACING.xs,
    },

    // Email field
    emailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.md,
      height: 52,
      gap: SPACING.sm,
    },
    emailInput: {
      flex: 1,
      color: colors.text,
      fontSize: FONTS.size.md,
    },

    // Category chips
    catsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.full,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    chipSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.accentDim,
    },
    chipEmoji: { fontSize: 14 },
    chipLabel: {
      color: colors.textMuted,
      fontSize: FONTS.size.xs,
      fontWeight: FONTS.weight.medium,
    },
    chipLabelSelected: {
      color: colors.accent,
      fontWeight: FONTS.weight.bold,
    },

    // Message textarea
    textarea: {
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: RADIUS.sm,
      padding: SPACING.md,
      color: colors.text,
      fontSize: FONTS.size.md,
      minHeight: 130,
      textAlignVertical: 'top',
    },
    textareaFocused: {
      borderColor: colors.accent,
    },
    charCount: {
      color: colors.textMuted,
      fontSize: FONTS.size.xs,
      textAlign: 'right',
      marginTop: -SPACING.sm,
    },
    charCountErr: { color: colors.accent },

    // Error message
    errorBox: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      backgroundColor: colors.accentDim, borderRadius: RADIUS.sm,
      borderWidth: 1, borderColor: colors.accent,
      padding: SPACING.sm,
    },
    errorText: { color: colors.accent, fontSize: FONTS.size.sm, flex: 1 },

    // Submit button
    submitBtn: {
      backgroundColor: colors.accent,
      borderRadius: 2,
      paddingVertical: SPACING.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#ff6b85',
      borderBottomColor: '#9e1a2e',
      borderRightColor: '#9e1a2e',
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    submitBtnDisabled: {
      opacity: 0.4,
    },
    submitText: {
      color: colors.text,
      fontSize: FONTS.size.md,
      fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace',
      letterSpacing: 2,
    },
    btnDot: {
      position: 'absolute', width: 5, height: 5, backgroundColor: colors.background,
    },

    // ── Success screen ──────────────────────────────────────────────────────────
    successView: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xl,
      paddingHorizontal: SPACING.xxl,
    },
    successIcon: { fontSize: 64 },
    successTitle: {
      color: colors.text,
      fontSize: FONTS.size.xl,
      fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace',
      textAlign: 'center',
    },
    successSub: {
      color: colors.textSecondary,
      fontSize: FONTS.size.sm,
      textAlign: 'center',
      lineHeight: 22,
    },
    successCloseBtn: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.sm,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.xxl,
    },
    successCloseBtnText: {
      color: colors.textMuted,
      fontSize: FONTS.size.md,
      fontWeight: FONTS.weight.medium,
    },
  });
}

// ─── SupportModal ─────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function SupportModal({ visible, onClose }: Props) {
  const { colors, fontFamily } = useTheme();
  const { session, isGuest } = useAuthContext();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);

  // Pré-rempli avec l'email du joueur connecté
  const defaultEmail = (!isGuest && session?.user.email) ? session.user.email : '';

  const [email,       setEmail]       = useState(defaultEmail);
  const [selectedCat, setSelectedCat] = useState<SupportCategory>(SUPPORT_CATS[0]);
  const [message,     setMessage]     = useState('');
  const [focused,     setFocused]     = useState(false);
  const [error,       setError]       = useState('');
  const [sending,     setSending]     = useState(false);
  const [sent,        setSent]        = useState(false);

  // Réinitialise quand la modal s'ouvre
  const handleOpen = useCallback(() => {
    setEmail((!isGuest && session?.user.email) ? session.user.email : '');
    setSelectedCat(SUPPORT_CATS[0]);
    setMessage('');
    setError('');
    setSending(false);
    setSent(false);
  }, [isGuest, session]);

  const handleSend = useCallback(async () => {
    setError('');

    // Validations
    const trimEmail = email.trim();
    const trimMsg   = message.trim();

    if (!trimEmail || !trimEmail.includes('@')) {
      setError('Merci d\'entrer un email valide pour qu\'on puisse te répondre.');
      return;
    }
    if (trimMsg.length < MIN_LENGTH) {
      setError(`Le message doit faire au moins ${MIN_LENGTH} caractères (${trimMsg.length}/${MIN_LENGTH}).`);
      return;
    }

    setSending(true);

    const date = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });

    const subject = `[PixelNight Support] - ${selectedCat.label}`;
    const body = [
      `Catégorie : ${selectedCat.emoji} ${selectedCat.label}`,
      `Email joueur : ${trimEmail}`,
      ``,
      `Message :`,
      trimMsg,
      ``,
      `---`,
      `Version app : ${APP_VERSION}`,
      `Date : ${date}`,
    ].join('\n');

    const mailUrl =
      `mailto:${SUPPORT_EMAIL}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    try {
      const canOpen = await Linking.canOpenURL(mailUrl);
      if (!canOpen) {
        setError('Aucune application mail trouvée sur cet appareil.');
        setSending(false);
        return;
      }
      await Linking.openURL(mailUrl);
      setSent(true);
    } catch (e) {
      setError('Impossible d\'ouvrir l\'application mail. Écris-nous directement à PixelNight04@gmail.com');
    } finally {
      setSending(false);
    }
  }, [email, message, selectedCat]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>

          {/* ── Header ────────────────────────────────────────────── */}
          <View style={styles.header}>
            <Ionicons name="mail-outline" size={20} color={colors.accent} />
            <View style={styles.headerLogo}>
              <View>
                <Text style={styles.headerPIXEL}>PIXEL<Text style={styles.headerNIGHT}>NIGHT</Text></Text>
                <Text style={styles.headerSub}>Nous contacter</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* ── Contenu ───────────────────────────────────────────── */}
          {sent ? (
            /* ── Écran de succès ── */
            <View style={styles.successView}>
              <Text style={styles.successIcon}>🙏</Text>
              <Text style={styles.successTitle}>Message envoyé !</Text>
              <Text style={styles.successSub}>
                On te répond sous 48h à {'\n'}
                <Text style={{ color: colors.accent }}>{email || SUPPORT_EMAIL}</Text>
                {'\n\n'}Merci pour ton retour, il aide PixelNight à s'améliorer !
              </Text>
              <TouchableOpacity style={styles.successCloseBtn} onPress={onClose}>
                <Text style={styles.successCloseBtnText}>Fermer</Text>
              </TouchableOpacity>
            </View>

          ) : (
            /* ── Formulaire ── */
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Email */}
              <Text style={styles.label}>Ton email</Text>
              <View style={styles.emailRow}>
                <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
                <TextInput
                  style={styles.emailInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="ton@email.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Catégorie du problème */}
              <Text style={styles.label}>Catégorie</Text>
              <View style={styles.catsWrap}>
                {SUPPORT_CATS.map((cat) => {
                  const sel = cat.id === selectedCat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.chip, sel && styles.chipSelected]}
                      onPress={() => setSelectedCat(cat)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.chipEmoji}>{cat.emoji}</Text>
                      <Text style={[styles.chipLabel, sel && styles.chipLabelSelected]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Message */}
              <Text style={styles.label}>Ton message</Text>
              <TextInput
                style={[styles.textarea, focused && styles.textareaFocused]}
                value={message}
                onChangeText={setMessage}
                placeholder="Décris ton problème en détail…"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={5}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                maxLength={1000}
              />
              <Text style={[styles.charCount, message.trim().length < MIN_LENGTH && message.length > 0 && styles.charCountErr]}>
                {message.trim().length} / {MIN_LENGTH} caractères min
              </Text>

              {/* Erreur */}
              {!!error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={15} color={colors.accent} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Bouton envoyer */}
              <TouchableOpacity
                style={[styles.submitBtn, sending && styles.submitBtnDisabled]}
                onPress={handleSend}
                disabled={sending}
                activeOpacity={0.85}
              >
                {/* Pixel corner dots */}
                <View style={[styles.btnDot, { top: 0, left: 0 }]} />
                <View style={[styles.btnDot, { top: 0, right: 0 }]} />
                <View style={[styles.btnDot, { bottom: 0, left: 0 }]} />
                <View style={[styles.btnDot, { bottom: 0, right: 0 }]} />

                {sending
                  ? <ActivityIndicator color={colors.text} />
                  : <>
                      <Ionicons name="send-outline" size={16} color={colors.text} />
                      <Text style={styles.submitText}>ENVOYER</Text>
                    </>
                }
              </TouchableOpacity>

            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
