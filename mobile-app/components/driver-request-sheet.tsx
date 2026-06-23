import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Slider from "@react-native-community/slider";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { buttonShadow } from "@/constants/button-shadow";
import { useDriverProfile } from "@/hooks/use-driver-profile";
import { useGarageVehicles } from "@/hooks/use-garage-vehicles";
import { saveCustomerRequestId } from "@/lib/customer-request-ids";
import { submitDriverInquiry } from "@/lib/driver-inquiry-api";
import { MAX_INQUIRY_PHOTOS, promptInquiryPhotoSource } from "@/lib/inquiry-photo-picker";
import { resolveCurrentDriverLocation } from "@/lib/driver-location";
import { formatVehicleSpecsSummary, type DriverVehicle } from "@/lib/driver-vehicles";
import type { RequestCategoryId } from "@/lib/request-category";
import type { MapServiceMarker } from "@/lib/map-services-api";
import { TowingServiceIcon, WideServiceIcon } from "@/components/service-category-icons";

export type { RequestCategoryId };

const DISMISS_DRAG_PX = 100;
const DISMISS_VELOCITY = 800;
const SHEET_HIDDEN_Y = Dimensions.get("window").height;
const SHEET_CLOSE_MS = 280;
const SHEET_OPEN_MS = 320;

const CATEGORIES: {
  id: RequestCategoryId;
  label: string;
}[] = [
  { id: "auto", label: "Autoservis" },
  { id: "tire", label: "Pneuservis" },
  { id: "towing", label: "Odťahovka" },
];

function ServiceCategoryIcon({
  categoryId,
  color,
}: {
  categoryId: RequestCategoryId;
  color: string;
}) {
  if (categoryId === "tire") {
    return <WideServiceIcon size={30} color={color} />;
  }

  if (categoryId === "towing") {
    return <TowingServiceIcon size={30} color={color} />;
  }

  return <FontAwesome name="wrench" size={28} color={color} />;
}

type SheetStep = "vehicle" | "details";

type DriverRequestSheetProps = {
  visible: boolean;
  onClose: () => void;
  onRequestCreated?: (requestId: string) => void;
  targetService?: MapServiceMarker | null;
};

export function DriverRequestSheet({
  visible,
  onClose,
  onRequestCreated,
  targetService = null,
}: DriverRequestSheetProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<SheetStep>("vehicle");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<RequestCategoryId | null>(null);
  const [city, setCity] = useState("");
  const [locationCoords, setLocationCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [radiusKm, setRadiusKm] = useState(50);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { profile, reload: reloadProfile } = useDriverProfile(visible);
  const { vehicles: garageVehicles } = useGarageVehicles(visible);

  const selectedVehicle = useMemo(
    () => garageVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null,
    [garageVehicles, selectedVehicleId],
  );

  const selectedCategoryLabel = useMemo(
    () => CATEGORIES.find((category) => category.id === selectedCategory)?.label ?? "",
    [selectedCategory],
  );

  const resetForm = () => {
    setStep("vehicle");
    setSelectedVehicleId(null);
    setSelectedCategory(null);
    setCity(targetService?.city.trim() ?? "");
    setLocationCoords(null);
    setRadiusKm(50);
    setDescription("");
    setPhotos([]);
    setPhotoError(null);
    setIsLocationLoading(false);
    setIsSubmitting(false);
    setLocationError(null);
    setSubmitError(null);
  };

  const translateY = useSharedValue(SHEET_HIDDEN_Y);
  const keyboardHeight = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const dragStartY = useSharedValue(0);
  const isClosing = useSharedValue(false);
  const scrollRef = useRef<Animated.ScrollView>(null);

  const finishClose = useCallback(() => {
    isClosing.value = false;
    keyboardHeight.value = 0;
    resetForm();
    onClose();
  }, [isClosing, keyboardHeight, onClose]);

  const animateClose = useCallback(() => {
    if (isClosing.value) {
      return;
    }
    isClosing.value = true;
    translateY.value = withTiming(
      SHEET_HIDDEN_Y,
      { duration: SHEET_CLOSE_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(finishClose)();
        } else {
          isClosing.value = false;
        }
      },
    );
  }, [finishClose, isClosing, translateY]);

  useLayoutEffect(() => {
    if (!visible) {
      return;
    }
    void reloadProfile();
    isClosing.value = false;
    keyboardHeight.value = 0;
    scrollY.value = 0;
    translateY.value = SHEET_HIDDEN_Y;
    if (targetService?.city.trim()) {
      setCity(targetService.city.trim());
    }
    translateY.value = withTiming(0, {
      duration: SHEET_OPEN_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, isClosing, keyboardHeight, reloadProfile, scrollY, targetService, translateY]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      keyboardHeight.value = withTiming(event.endCoordinates.height, {
        duration: Platform.OS === "ios" ? (event.duration ?? 250) : 220,
        easing: Easing.out(Easing.cubic),
      });
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      keyboardHeight.value = withTiming(0, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
      });
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [visible, keyboardHeight]);

  const scrollToFocusedField = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const handleCategoryPress = (categoryId: RequestCategoryId) => {
    setSelectedCategory(categoryId);
  };

  const isDirectInquiry = Boolean(targetService);

  const handleContinueToDetails = () => {
    if (!selectedVehicleId) {
      return;
    }

    if (!isDirectInquiry && !selectedCategory) {
      return;
    }

    setStep("details");
  };

  const handleMyLocation = async () => {
    setLocationError(null);
    setIsLocationLoading(true);
    try {
      const location = await resolveCurrentDriverLocation();
      setCity(location.city);
      setLocationCoords({
        latitude: location.latitude,
        longitude: location.longitude,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Polohu sa nepodarilo načítať.";
      setLocationError(message);
    } finally {
      setIsLocationLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || !selectedVehicle) {
      return;
    }

    if (!isDirectInquiry && !selectedCategory) {
      return;
    }

    const trimmedCity =
      city.trim() || targetService?.city.trim() || "";
    if (!trimmedCity) {
      setSubmitError(
        isDirectInquiry
          ? "Chýba adresa servisu."
          : "Zadajte mesto alebo použite „Moja poloha“.",
      );
      return;
    }

    const trimmedDescription = description.trim();
    if (isDirectInquiry && !trimmedDescription && photos.length === 0) {
      setSubmitError("Opíšte, čo potrebujete, alebo priložte fotku.");
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const created = await submitDriverInquiry({
        requestCategory: isDirectInquiry ? "auto" : selectedCategory!,
        licensePlate: selectedVehicle.plate,
        vehicleName: selectedVehicle.label,
        vehicleTitle: selectedVehicle.label,
        locationCity: trimmedCity,
        radiusKm: isDirectInquiry ? 0 : radiusKm,
        description: trimmedDescription,
        photos,
        latitude: locationCoords?.latitude,
        longitude: locationCoords?.longitude,
        userName: profile.userName,
        phone: profile.phone,
        targetCompanyId: targetService?.id,
        targetCompanyName: targetService?.companyName,
        vehicleSpecs: {
          vin: selectedVehicle.vin,
          engineVolume: selectedVehicle.engineVolume,
          power: selectedVehicle.power,
          fuelType: selectedVehicle.fuelType,
          year: selectedVehicle.year,
          engine: selectedVehicle.engine,
          mileageKm: selectedVehicle.mileageKm,
          transmission: selectedVehicle.transmission,
        },
      });
      if (created?.id) {
        await saveCustomerRequestId(created.id);
        onRequestCreated?.(created.id);
      }
      animateClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Dopyt sa nepodarilo odoslať.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPhoto = useCallback(() => {
    if (photos.length >= MAX_INQUIRY_PHOTOS) {
      setPhotoError(`Môžete pridať najviac ${MAX_INQUIRY_PHOTOS} fotky.`);
      return;
    }

    setPhotoError(null);
    promptInquiryPhotoSource(
      (photo) => {
        setPhotos((current) => [...current, photo].slice(0, MAX_INQUIRY_PHOTOS));
        setPhotoError(null);
      },
      (message) => setPhotoError(message),
    );
  }, [photos.length]);

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index));
    setPhotoError(null);
  }, []);

  const scrollGesture = useMemo(() => Gesture.Native(), []);

  const handlePanGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-6, 6])
        .failOffsetX([-20, 20])
        .onBegin(() => {
          dragStartY.value = translateY.value;
        })
        .onUpdate((event) => {
          const nextY = dragStartY.value + event.translationY;
          translateY.value = Math.min(Math.max(nextY, 0), SHEET_HIDDEN_Y);
        })
        .onEnd((event) => {
          const shouldDismiss =
            translateY.value > DISMISS_DRAG_PX ||
            (event.velocityY > DISMISS_VELOCITY && translateY.value > 40);

          if (shouldDismiss) {
            if (!isClosing.value) {
              isClosing.value = true;
              translateY.value = withTiming(
                SHEET_HIDDEN_Y,
                { duration: SHEET_CLOSE_MS, easing: Easing.in(Easing.cubic) },
                (finished) => {
                  if (finished) {
                    runOnJS(finishClose)();
                  } else {
                    isClosing.value = false;
                  }
                },
              );
            }
            return;
          }

          translateY.value = withSpring(0, { damping: 22, stiffness: 320 });
        }),
    [dragStartY, finishClose, isClosing, translateY],
  );

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value - keyboardHeight.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [0, SHEET_HIDDEN_Y],
      [0.55, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const sheetBottomPadding = Math.max(insets.bottom, 16);

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={animateClose}
    >
      <GestureHandlerRootView style={styles.modalRoot}>
        <View className="flex-1 justify-end">
          <Pressable
            accessibilityLabel="Zavrieť dopyt"
            onPress={animateClose}
            style={styles.backdropPressable}
          >
            <Animated.View pointerEvents="none" style={[styles.backdropFill, backdropAnimatedStyle]} />
          </Pressable>

          <Animated.View
            className="max-h-[92%] rounded-t-3xl bg-white"
            style={[sheetAnimatedStyle, { paddingBottom: sheetBottomPadding }]}
          >
            <GestureDetector gesture={handlePanGesture}>
              <View
                accessibilityLabel="Potiahnite pre zatvorenie dopytu"
                accessibilityRole="adjustable"
                style={styles.handleTouchArea}
              >
                <View className="h-1.5 w-12 rounded-full bg-slate-300" />
              </View>
            </GestureDetector>

            <GestureDetector gesture={scrollGesture}>
                <Animated.ScrollView
                  ref={scrollRef}
                  className="px-5"
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                  automaticallyAdjustKeyboardInsets
                  showsVerticalScrollIndicator={false}
                  onScroll={scrollHandler}
                  scrollEventThrottle={16}
                  contentContainerStyle={styles.scrollContent}
                  bounces
                >
                  {step === "vehicle" ? (
                    <VehicleStep
                      vehicles={garageVehicles}
                      selectedVehicleId={selectedVehicleId}
                      selectedCategory={selectedCategory}
                      targetServiceName={targetService?.companyName ?? null}
                      onSelectVehicle={setSelectedVehicleId}
                      onSelectCategory={handleCategoryPress}
                      onContinue={handleContinueToDetails}
                    />
                  ) : (
                    <DetailsStep
                      categoryLabel={selectedCategoryLabel}
                      vehicleLabel={selectedVehicle?.label ?? ""}
                      targetServiceName={targetService?.companyName ?? null}
                      city={city}
                      radiusKm={radiusKm}
                      description={description}
                      photos={photos}
                      photoError={photoError}
                      isDirectInquiry={isDirectInquiry}
                      isLocationLoading={isLocationLoading}
                      isSubmitting={isSubmitting}
                      locationError={locationError}
                      submitError={submitError}
                      onCityChange={(value) => {
                        setCity(value);
                        setLocationCoords(null);
                        setLocationError(null);
                      }}
                      onRadiusChange={setRadiusKm}
                      onDescriptionChange={setDescription}
                      onAddPhoto={handleAddPhoto}
                      onRemovePhoto={handleRemovePhoto}
                      onFieldFocus={scrollToFocusedField}
                      onMyLocation={() => {
                        void handleMyLocation();
                      }}
                      onBack={() => setStep("vehicle")}
                      onSubmit={() => {
                        void handleSubmit();
                      }}
                      onCancel={animateClose}
                    />
                  )}
                </Animated.ScrollView>
            </GestureDetector>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  scrollContent: {
    paddingBottom: 32,
  },
  handleTouchArea: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  optionDefault: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  optionSelected: {
    borderWidth: 2,
    borderColor: "#0b194f",
    backgroundColor: "#f8fafc",
  },
});

function VehicleOptionCard({
  vehicle,
  isSelected,
  onPress,
}: {
  vehicle: DriverVehicle;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-xl px-4 py-3"
      style={[buttonShadow, isSelected ? styles.optionSelected : styles.optionDefault]}
    >
      <Text className="text-base font-semibold text-casker-navy">{vehicle.label}</Text>
      <Text className="mt-0.5 text-sm text-slate-500">EČ {vehicle.plate}</Text>
      <Text className="mt-1 text-xs leading-5 text-slate-600">
        {formatVehicleSpecsSummary(vehicle)}
      </Text>
      <Text className="mt-0.5 text-xs text-slate-500">
        {vehicle.fuelType} · {vehicle.transmission} · {vehicle.engineVolume}
      </Text>
    </Pressable>
  );
}

function ServiceCategoryCard({
  categoryId,
  label,
  isSelected,
  onPress,
}: {
  categoryId: RequestCategoryId;
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      className="flex-row items-center justify-center gap-3 rounded-2xl py-4"
      style={[buttonShadow, isSelected ? styles.optionSelected : styles.optionDefault]}
    >
      <ServiceCategoryIcon
        categoryId={categoryId}
        color={isSelected ? "#0b194f" : "#0b194f"}
      />
      <Text className="text-lg font-bold text-casker-navy">{label}</Text>
    </Pressable>
  );
}

function VehicleStep({
  vehicles,
  selectedVehicleId,
  selectedCategory,
  targetServiceName,
  onSelectVehicle,
  onSelectCategory,
  onContinue,
}: {
  vehicles: DriverVehicle[];
  selectedVehicleId: string | null;
  selectedCategory: RequestCategoryId | null;
  targetServiceName: string | null;
  onSelectVehicle: (id: string) => void;
  onSelectCategory: (id: RequestCategoryId) => void;
  onContinue: () => void;
}) {
  return (
    <View className="pb-6">
      <Text className="text-center text-2xl font-black tracking-wide text-casker-navy">cAsker</Text>
      <Text className="mt-1 text-center text-base font-semibold text-casker-navy/80">
        {targetServiceName ? "Priamy dopyt" : "Dopyt"}
      </Text>
      {targetServiceName ? (
        <Text className="mt-2 text-center text-sm font-medium text-casker-navy/70">
          Pre {targetServiceName}
        </Text>
      ) : null}

      <Text className="mt-6 text-sm font-semibold uppercase tracking-wide text-casker-navy/60">
        Vyberte vozidlo
      </Text>

      <View className="mt-3 gap-2">
        {vehicles.length === 0 ? (
          <View className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5">
            <Text className="text-center text-sm text-slate-600">
              Nemáte žiadne vozidlo v garáži. Pridajte ho v menu Garáž.
            </Text>
          </View>
        ) : (
          vehicles.map((vehicle) => {
            const isSelected = selectedVehicleId === vehicle.id;
            return (
              <VehicleOptionCard
                key={vehicle.id}
                vehicle={vehicle}
                isSelected={isSelected}
                onPress={() => onSelectVehicle(vehicle.id)}
              />
            );
          })
        )}
      </View>

      {selectedVehicleId ? (
        <View className="mt-6">
          {targetServiceName ? (
            <Pressable
              onPress={onContinue}
              className="items-center rounded-2xl bg-casker-navy py-4 active:opacity-90"
              style={buttonShadow}
            >
              <Text className="text-base font-bold text-white">Pokračovať</Text>
            </Pressable>
          ) : (
            <>
              <Text className="mb-3 text-sm font-semibold uppercase tracking-wide text-casker-navy/60">
                Typ služby
              </Text>
              <View className="gap-3">
                {CATEGORIES.map((category) => (
                  <ServiceCategoryCard
                    key={category.id}
                    categoryId={category.id}
                    label={category.label}
                    isSelected={selectedCategory === category.id}
                    onPress={() => onSelectCategory(category.id)}
                  />
                ))}
              </View>

              {selectedCategory ? (
                <Pressable
                  onPress={onContinue}
                  className="mt-5 items-center rounded-2xl bg-casker-navy py-4 active:opacity-90"
                  style={buttonShadow}
                >
                  <Text className="text-base font-bold text-white">Pokračovať</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

function DetailsStep({
  categoryLabel,
  vehicleLabel,
  targetServiceName,
  city,
  radiusKm,
  description,
  photos,
  photoError,
  isDirectInquiry,
  isLocationLoading,
  isSubmitting,
  locationError,
  submitError,
  onCityChange,
  onRadiusChange,
  onDescriptionChange,
  onAddPhoto,
  onRemovePhoto,
  onFieldFocus,
  onMyLocation,
  onBack,
  onSubmit,
  onCancel,
}: {
  categoryLabel: string;
  vehicleLabel: string;
  targetServiceName: string | null;
  city: string;
  radiusKm: number;
  description: string;
  photos: string[];
  photoError: string | null;
  isDirectInquiry: boolean;
  isLocationLoading: boolean;
  isSubmitting: boolean;
  locationError: string | null;
  submitError: string | null;
  onCityChange: (value: string) => void;
  onRadiusChange: (value: number) => void;
  onDescriptionChange: (value: string) => void;
  onAddPhoto: () => void;
  onRemovePhoto: (index: number) => void;
  onFieldFocus: () => void;
  onMyLocation: () => void;
  onBack: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <View className="pb-4">
      <Pressable
        onPress={onBack}
        className="mb-4 flex-row items-center gap-2 self-start rounded-lg bg-white px-2 py-1"
        style={buttonShadow}
      >
        <FontAwesome name="chevron-left" size={14} color="#0b194f" />
        <Text className="text-sm font-medium text-casker-navy/70">Späť</Text>
      </Pressable>

      <Text className="text-xl font-bold text-casker-navy">
        {isDirectInquiry ? "Čo potrebujete?" : "Kde hľadám dopyt"}
      </Text>
      <Text className="mt-1 text-sm text-slate-500">
        {isDirectInquiry && targetServiceName
          ? `${targetServiceName}${vehicleLabel ? ` · ${vehicleLabel}` : ""}`
          : `${categoryLabel}${vehicleLabel ? ` · ${vehicleLabel}` : ""}`}
      </Text>

      {!isDirectInquiry ? (
        <>
          <View className="mt-5 flex-row items-center gap-2">
            <Pressable
              onPress={onMyLocation}
              disabled={isLocationLoading || isSubmitting}
              className="flex-row items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 active:bg-slate-50 disabled:opacity-60"
              style={buttonShadow}
            >
              <FontAwesome name="location-arrow" size={16} color="#0b194f" />
              <Text className="text-sm font-semibold text-casker-navy">
                {isLocationLoading ? "Načítavam polohu…" : "Moja poloha"}
              </Text>
            </Pressable>
          </View>

          {locationError ? (
            <Text className="mt-2 text-sm text-red-600">{locationError}</Text>
          ) : null}

          <Text className="mt-4 text-xs font-semibold uppercase tracking-wide text-casker-navy/60">
            Mesto / lokalita
          </Text>
          <TextInput
            value={city}
            onChangeText={onCityChange}
            onFocus={onFieldFocus}
            placeholder="Napr. Košice"
            placeholderTextColor="#94a3b8"
            className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-casker-navy"
          />

          <Text className="mt-5 text-xs font-semibold uppercase tracking-wide text-casker-navy/60">
            V okolí
          </Text>
          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-sm text-slate-600">Vzdialenosť</Text>
            <Text className="text-lg font-bold text-casker-navy">{Math.round(radiusKm)} km</Text>
          </View>
          <Slider
            minimumValue={5}
            maximumValue={150}
            step={5}
            value={radiusKm}
            onValueChange={onRadiusChange}
            minimumTrackTintColor="#2563eb"
            maximumTrackTintColor="#e2e8f0"
            thumbTintColor="#0b194f"
            style={{ width: "100%", height: 40 }}
          />
        </>
      ) : null}

      {!isDirectInquiry ? (
        <Text className="mt-4 text-xs font-semibold uppercase tracking-wide text-casker-navy/60">
          Popis
        </Text>
      ) : (
        <Text className="mt-5 text-xs font-semibold uppercase tracking-wide text-casker-navy/60">
          Popis
        </Text>
      )}
      <TextInput
        value={description}
        onChangeText={onDescriptionChange}
        onFocus={onFieldFocus}
        placeholder={
          isDirectInquiry
            ? "Napr. potrebujem vymeniť olej a filtre…"
            : "Opíšte závadu alebo čo potrebujete…"
        }
        placeholderTextColor="#94a3b8"
        multiline
        textAlignVertical="top"
        className="mt-2 min-h-[120px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-casker-navy"
      />

      {photos.length > 0 ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {photos.map((photo, index) => (
            <View key={`${index}-${photo.slice(-16)}`} className="relative">
              <Image
                source={{ uri: photo }}
                className="h-20 w-20 rounded-xl border border-slate-200"
                resizeMode="cover"
              />
              <Pressable
                onPress={() => onRemovePhoto(index)}
                accessibilityLabel="Odstrániť fotku"
                className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full bg-slate-800"
              >
                <FontAwesome name="times" size={12} color="#fff" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <Pressable
        onPress={onAddPhoto}
        disabled={isSubmitting || photos.length >= MAX_INQUIRY_PHOTOS}
        className="mt-3 flex-row items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-3 active:bg-slate-50 disabled:opacity-50"
        style={buttonShadow}
      >
        <FontAwesome name="camera" size={16} color="#0b194f" />
        <Text className="text-sm font-semibold text-casker-navy">Pridať fotku</Text>
      </Pressable>

      {photoError ? <Text className="mt-2 text-sm text-red-600">{photoError}</Text> : null}

      {submitError ? (
        <Text className="mt-4 text-sm text-red-600" role="alert">
          {submitError}
        </Text>
      ) : null}

      <Pressable
        onPress={onSubmit}
        disabled={isSubmitting}
        className="mt-6 items-center rounded-2xl border border-slate-200 bg-white py-4 active:bg-slate-50 disabled:opacity-60"
        style={buttonShadow}
      >
        <Text className="text-base font-bold text-casker-navy">
          {isSubmitting ? "Odosielam…" : isDirectInquiry ? "Poslať dopyt" : "Odoslať dopyt"}
        </Text>
      </Pressable>

      <Pressable
        onPress={onCancel}
        disabled={isSubmitting}
        className="mt-3 items-center rounded-2xl border border-slate-200 bg-white py-4 active:bg-slate-50 disabled:opacity-60"
        style={buttonShadow}
      >
        <Text className="text-base font-bold text-casker-navy">Zrušiť</Text>
      </Pressable>
    </View>
  );
}
