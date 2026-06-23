import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { SafeAreaView } from "react-native-safe-area-context";

import { buttonShadow } from "@/constants/button-shadow";
import { useDriverProfile } from "@/hooks/use-driver-profile";
import { isValidEmail } from "@/lib/driver-profile";
import { useDriverAuth } from "@/contexts/driver-auth-context";
import { deleteDriverAccountLocally } from "@/lib/driver-session";
import { updateDriverAuthEmail } from "@/lib/driver-auth-credentials";

type AccountPlaceholderScreenProps = {
  visible: boolean;
  onClose: () => void;
  onSessionChanged?: () => void;
};

type EditableField = "userName" | "phone" | "email";

type AccountFieldRowProps = {
  icon: "user" | "mobile" | "envelope-o";
  value: string;
  onEdit: () => void;
};

type AccountActionRowProps = {
  icon: "sign-out" | "trash-o";
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

const FIELD_LABELS: Record<EditableField, string> = {
  userName: "Meno",
  phone: "Telefón",
  email: "E-mail",
};

function AccountFieldRow({ icon, value, onEdit }: AccountFieldRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <FontAwesome name={icon} size={22} color="#1f2937" />
      </View>

      <View style={styles.valueWrap}>
        <Text style={styles.valueText}>{value}</Text>
      </View>

      <Pressable onPress={onEdit} hitSlop={8} className="active:opacity-70">
        <Text style={styles.editText}>Upraviť</Text>
      </Pressable>
    </View>
  );
}

function AccountActionRow({ icon, label, onPress, disabled = false }: AccountActionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="active:opacity-70 disabled:opacity-50"
      style={styles.actionRow}
    >
      <View style={styles.iconWrap}>
        <FontAwesome name={icon} size={22} color="#1f2937" />
      </View>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

export function AccountPlaceholderScreen({
  visible,
  onClose,
  onSessionChanged,
}: AccountPlaceholderScreenProps) {
  const { signOut } = useDriverAuth();
  const { profile, isLoading, isSaving, reload, updateProfile } = useDriverProfile(visible);
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (visible) {
      void reload();
      setEditingField(null);
      setEditError(null);
    }
  }, [reload, visible]);

  const openEditor = (field: EditableField) => {
    const currentValue =
      field === "userName"
        ? profile.userName
        : field === "phone"
          ? profile.phoneDisplay
          : profile.email;

    setDraftValue(currentValue);
    setEditError(null);
    setEditingField(field);
  };

  const closeEditor = () => {
    if (isSaving) {
      return;
    }

    setEditingField(null);
    setEditError(null);
  };

  const handleSave = async () => {
    const trimmed = draftValue.trim();
    if (!editingField) {
      return;
    }

    if (editingField === "userName") {
      if (trimmed.length < 2) {
        setEditError("Zadajte aspoň 2 znaky.");
        return;
      }

      await updateProfile({ userName: trimmed });
      closeEditor();
      return;
    }

    if (editingField === "phone") {
      const digits = trimmed.replace(/\D/g, "");
      if (digits.length < 9) {
        setEditError("Zadajte platné telefónne číslo.");
        return;
      }

      await updateProfile({ phone: trimmed, phoneDisplay: trimmed });
      closeEditor();
      return;
    }

    if (!isValidEmail(trimmed)) {
      setEditError("Zadajte platný e-mail.");
      return;
    }

    await updateProfile({ email: trimmed });
    await updateDriverAuthEmail(trimmed);
    closeEditor();
  };

  const handleLogout = () => {
    Alert.alert("Odhlásiť sa", "Naozaj sa chcete odhlásiť?", [
      { text: "Zrušiť", style: "cancel" },
      {
        text: "Odhlásiť sa",
        onPress: () => {
          void (async () => {
            setIsLoggingOut(true);
            try {
              await signOut();
              onSessionChanged?.();
              onClose();
            } finally {
              setIsLoggingOut(false);
            }
          })();
        },
      },
    ]);
  };

  const confirmDeleteAccount = () => {
    Alert.alert("Naozaj chcete vymazať účet?", "Táto akcia je nevratná.", [
      { text: "Zrušiť", style: "cancel" },
      {
        text: "Vymazať účet",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setIsDeleting(true);
            try {
              await deleteDriverAccountLocally();
              await signOut();
              await reload();
              onSessionChanged?.();
              onClose();
              Alert.alert("Hotovo", "Účet bol úspešne vymazaný.");
            } finally {
              setIsDeleting(false);
            }
          })();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Odstrániť účet",
      "Týmto sa odstránia všetky údaje účtu z tohto zariadenia.",
      [
        { text: "Zrušiť", style: "cancel" },
        {
          text: "Pokračovať",
          style: "destructive",
          onPress: confirmDeleteAccount,
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
        <View className="flex-row items-center border-b border-slate-200 px-4 py-3">
          <Pressable
            onPress={onClose}
            className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 active:opacity-80"
            style={buttonShadow}
          >
            <FontAwesome name="chevron-left" size={16} color="#0b194f" />
          </Pressable>
          <Text className="ml-3 text-xl font-bold text-casker-navy">Účet</Text>
        </View>

        <View className="flex-1">
          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#0b194f" />
            </View>
          ) : (
            <>
              <View style={styles.list}>
                <AccountFieldRow
                  icon="user"
                  value={profile.userName}
                  onEdit={() => openEditor("userName")}
                />
                <AccountFieldRow
                  icon="mobile"
                  value={profile.phoneDisplay}
                  onEdit={() => openEditor("phone")}
                />
                <AccountFieldRow
                  icon="envelope-o"
                  value={profile.email}
                  onEdit={() => openEditor("email")}
                />
              </View>

              <View style={styles.bottomActions}>
                <AccountActionRow
                  icon="sign-out"
                  label="Odhlásiť sa"
                  onPress={handleLogout}
                  disabled={isLoggingOut || isDeleting}
                />
                <AccountActionRow
                  icon="trash-o"
                  label="Odstrániť účet"
                  onPress={handleDeleteAccount}
                  disabled={isLoggingOut || isDeleting}
                />
              </View>
            </>
          )}
        </View>

        <Modal
          visible={editingField !== null}
          transparent
          animationType="fade"
          onRequestClose={closeEditor}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.editorOverlay}
          >
            <Pressable style={styles.editorBackdrop} onPress={closeEditor} />

            <View style={styles.editorCard}>
              <Text className="text-lg font-bold text-casker-navy">
                {editingField ? FIELD_LABELS[editingField] : ""}
              </Text>

              <TextInput
                value={draftValue}
                onChangeText={(value) => {
                  setDraftValue(value);
                  setEditError(null);
                }}
                autoFocus
                editable={!isSaving}
                keyboardType={
                  editingField === "phone"
                    ? "phone-pad"
                    : editingField === "email"
                      ? "email-address"
                      : "default"
                }
                autoCapitalize={editingField === "email" ? "none" : "words"}
                autoCorrect={false}
                placeholder={
                  editingField === "phone"
                    ? "+421 944 294 400"
                    : editingField === "email"
                      ? "meno@email.sk"
                      : "Vaše meno"
                }
                placeholderTextColor="#94a3b8"
                className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-casker-navy"
              />

              {editError ? (
                <Text className="mt-2 text-sm text-red-600">{editError}</Text>
              ) : null}

              <View className="mt-5 flex-row gap-3">
                <Pressable
                  onPress={closeEditor}
                  disabled={isSaving}
                  className="flex-1 items-center rounded-xl border border-slate-200 bg-white py-3 active:bg-slate-50 disabled:opacity-60"
                >
                  <Text className="text-base font-semibold text-slate-600">Zrušiť</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    void handleSave();
                  }}
                  disabled={isSaving}
                  className="flex-1 items-center rounded-xl bg-casker-navy py-3 active:opacity-90 disabled:opacity-60"
                  style={buttonShadow}
                >
                  <Text className="text-base font-semibold text-white">
                    {isSaving ? "Ukladám…" : "Uložiť"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingTop: 4,
  },
  bottomActions: {
    marginTop: "auto",
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  iconWrap: {
    width: 30,
    alignItems: "center",
    marginRight: 14,
  },
  valueWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  valueText: {
    fontSize: 17,
    lineHeight: 22,
    color: "#111827",
  },
  actionText: {
    fontSize: 17,
    lineHeight: 22,
    color: "#111827",
  },
  editText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "500",
    color: "#0b194f",
  },
  editorOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  editorBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  editorCard: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
});
