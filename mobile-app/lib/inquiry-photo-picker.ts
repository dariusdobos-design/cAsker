import { Alert } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

export const MAX_INQUIRY_PHOTOS = 4;
const MAX_DIMENSION = 1280;

async function resizeToDataUrl(uri: string): Promise<string> {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION } }],
    {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );

  if (!manipulated.base64) {
    throw new Error("Fotku sa nepodarilo spracovať.");
  }

  return `data:image/jpeg;base64,${manipulated.base64}`;
}

async function pickFromCamera(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Bez prístupu k fotoaparátu fotku nepridáte.");
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 1,
  });

  if (result.canceled || !result.assets[0]?.uri) {
    return null;
  }

  return resizeToDataUrl(result.assets[0].uri);
}

async function pickFromLibrary(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Bez prístupu k galérii fotku nepridáte.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
    allowsMultipleSelection: false,
  });

  if (result.canceled || !result.assets[0]?.uri) {
    return null;
  }

  return resizeToDataUrl(result.assets[0].uri);
}

export function promptInquiryPhotoSource(
  onPhotoPicked: (photo: string) => void,
  onError: (message: string) => void,
) {
  Alert.alert("Pridať fotku", "Vyberte spôsob", [
    {
      text: "Odfotiť",
      onPress: () => {
        void pickFromCamera()
          .then((photo) => {
            if (photo) {
              onPhotoPicked(photo);
            }
          })
          .catch((error) => {
            onError(error instanceof Error ? error.message : "Fotku sa nepodarilo pridať.");
          });
      },
    },
    {
      text: "Vybrať z galérie",
      onPress: () => {
        void pickFromLibrary()
          .then((photo) => {
            if (photo) {
              onPhotoPicked(photo);
            }
          })
          .catch((error) => {
            onError(error instanceof Error ? error.message : "Fotku sa nepodarilo pridať.");
          });
      },
    },
    { text: "Zrušiť", style: "cancel" },
  ]);
}
