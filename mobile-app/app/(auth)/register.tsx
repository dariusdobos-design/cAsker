import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthTextField } from "@/components/auth-text-field";
import { CaskerLogo } from "@/components/casker-logo";
import { buttonShadow } from "@/constants/button-shadow";
import { useDriverAuth } from "@/contexts/driver-auth-context";
import { saveDriverAuthCredentials, hasRegisteredAccount } from "@/lib/driver-auth-credentials";
import {
  formatPhoneForApi,
  formatPhoneForDisplay,
  isValidEmail,
} from "@/lib/driver-profile";
import { saveDriverProfile } from "@/lib/driver-profile-storage";

const MIN_PASSWORD_LENGTH = 6;

export default function AuthRegisterScreen() {
  const router = useRouter();
  const { signIn } = useDriverAuth();
  const [userName, setUserName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async () => {
    const trimmedName = userName.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedName) {
      setError("Zadajte meno.");
      return;
    }

    if (!trimmedPhone) {
      setError("Zadajte telefónne číslo.");
      return;
    }

    const normalizedPhone = formatPhoneForApi(trimmedPhone);
    if (normalizedPhone.replace(/\D/g, "").length < 9) {
      setError("Zadajte platné telefónne číslo.");
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setError("Zadajte platný e-mail.");
      return;
    }

    if (trimmedPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Heslo musí mať aspoň ${MIN_PASSWORD_LENGTH} znakov.`);
      return;
    }

    if (trimmedPassword !== trimmedConfirm) {
      setError("Heslá sa nezhodujú.");
      return;
    }

    const completeRegistration = async () => {
      setError(null);
      setIsSubmitting(true);

      try {
        await saveDriverProfile({
          userName: trimmedName,
          phone: normalizedPhone,
          phoneDisplay: formatPhoneForDisplay(trimmedPhone),
          email: trimmedEmail,
        });
        await saveDriverAuthCredentials(trimmedEmail, trimmedPassword);
        await signIn();
      } catch {
        Alert.alert("Chyba", "Registráciu sa nepodarilo dokončiť. Skúste to znova.");
      } finally {
        setIsSubmitting(false);
      }
    };

    if (await hasRegisteredAccount()) {
      Alert.alert(
        "Účet už existuje",
        "Na tomto telefóne je uložený účet. Ak ste zabudli heslo, môžete ho obnoviť novou registráciou — lokálne prihlasovacie údaje sa prepíšu.",
        [
          { text: "Zrušiť", style: "cancel" },
          { text: "Obnoviť účet", onPress: () => void completeRegistration() },
        ],
      );
      return;
    }

    await completeRegistration();
  };

  return (
    <SafeAreaView className="flex-1 bg-casker-navy">
      <StatusBar style="light" />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 4 : 0}
      >
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:opacity-80"
            style={buttonShadow}
          >
            <FontAwesome name="chevron-left" size={16} color="#ffffff" />
          </Pressable>
          <Text className="ml-3 text-xl font-bold text-white">Registrácia</Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="grow px-6 pb-10"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-6 items-center pt-2">
            <CaskerLogo />
          </View>

          <View
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-5"
            style={buttonShadow}
          >
            <AuthTextField
              label="Meno"
              value={userName}
              onChangeText={setUserName}
              placeholder="Vaše meno"
              autoCapitalize="words"
            />
            <AuthTextField
              label="Telefón"
              value={phone}
              onChangeText={setPhone}
              placeholder="+421 9XX XXX XXX"
              keyboardType="phone-pad"
            />
            <AuthTextField
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="vas@email.sk"
              keyboardType="email-address"
            />
            <AuthTextField
              label="Heslo"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
            />
            <AuthTextField
              label="Potvrdenie hesla"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              secureTextEntry
            />

            {error ? <Text className="mb-3 text-sm text-red-300">{error}</Text> : null}

            <Pressable
              onPress={() => void handleRegister()}
              disabled={isSubmitting}
              className="items-center rounded-xl bg-white py-3.5 active:opacity-90"
              style={buttonShadow}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#0b194f" />
              ) : (
                <Text className="text-base font-bold text-casker-navy">Vytvoriť účet</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
