// Runs one phone tool on the device (React Native / Expo side). The decision to run it was made by the caller.
import { Alert, Platform } from "react-native"
import * as Clipboard from "expo-clipboard"
import * as Device from "expo-device"
import * as Battery from "expo-battery"
import * as Location from "expo-location"
import * as Speech from "expo-speech"
import * as Notifications from "expo-notifications"
import * as ImagePicker from "expo-image-picker"
import * as ImageManipulator from "expo-image-manipulator"
import type { PhoneToolName } from "./phone-tools"

const PHOTO_MAX = 1280

export function confirm(title: string, message: string, allow: string, decline: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: decline, style: "cancel", onPress: () => resolve(false) },
        { text: allow, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    )
  })
}

async function takePhoto(): Promise<{ base64: string; mime: string }> {
  const perm = await ImagePicker.requestCameraPermissionsAsync()
  if (!perm.granted) throw new Error("camera permission was not granted on the phone")
  const shot = await ImagePicker.launchCameraAsync({ quality: 1 })
  if (shot.canceled) throw new Error("the user cancelled the photo")
  const a = shot.assets[0]
  const big = Math.max(a.width, a.height) > PHOTO_MAX
  const actions: ImageManipulator.Action[] = big ? [{ resize: a.width >= a.height ? { width: PHOTO_MAX } : { height: PHOTO_MAX } }] : []
  const r = await ImageManipulator.manipulateAsync(a.uri, actions, { format: ImageManipulator.SaveFormat.JPEG, compress: 0.7, base64: true })
  if (!r.base64) throw new Error("could not read the photo")
  return { base64: r.base64, mime: "image/jpeg" }
}

export async function runPhoneTool(tool: PhoneToolName, args: Record<string, string>): Promise<unknown> {
  switch (tool) {
    case "phone_info": {
      const level = await Battery.getBatteryLevelAsync().catch(() => -1)
      return {
        model: Device.modelName,
        brand: Device.brand,
        os: `${Platform.OS} ${Device.osVersion ?? ""}`.trim(),
        batteryPercent: level >= 0 ? Math.round(level * 100) : null,
      }
    }
    case "phone_clipboard_read":
      return await Clipboard.getStringAsync()
    case "phone_clipboard_write":
      await Clipboard.setStringAsync(args.text)
      return "copied"
    case "phone_notify":
      await Notifications.scheduleNotificationAsync({ content: { title: args.title || "OpenCode", body: args.body }, trigger: null })
      return "shown"
    case "phone_speak":
      Speech.speak(args.text)
      return "speaking"
    case "phone_location": {
      const perm = await Location.requestForegroundPermissionsAsync()
      if (!perm.granted) throw new Error("location permission was not granted on the phone")
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      return { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyMeters: p.coords.accuracy }
    }
    case "phone_photo":
      return await takePhoto()
  }
}
