import Toast from "react-native-toast-message";

export type ToastTone = "success" | "error" | "info";

/**
 * App-wide toast helper. Mount `<Toast />` once in the root layout.
 */
export function showToast(
  message: string,
  tone: ToastTone = "info",
  options?: { title?: string },
) {
  const text = (message || "").trim();
  if (!text) return;

  const type =
    tone === "success" ? "success" : tone === "error" ? "error" : "info";

  Toast.show({
    type,
    text1:
      options?.title ??
      (tone === "success" ? "Success" : tone === "error" ? "Error" : "Notice"),
    text2: text,
    position: "top",
    visibilityTime: tone === "error" ? 4500 : 3200,
    topOffset: 56,
  });
}

export function toastSuccess(message: string, title = "Success") {
  showToast(message, "success", { title });
}

export function toastError(message: string, title = "Error") {
  showToast(message, "error", { title });
}

export function toastInfo(message: string, title = "Notice") {
  showToast(message, "info", { title });
}
