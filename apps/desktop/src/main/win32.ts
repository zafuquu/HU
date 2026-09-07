/**
 * Win32 window bridge — in-process equivalent of the audited native host's
 * get-window-bounds + place-window-above. Degrades gracefully when koffi or
 * the APIs are unavailable so callers can simply hide the overlay.
 */
import { MISSING_WINDOW_BOUNDS, type WindowBounds } from "@havoc-unleash/contracts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type K = any;

let funcs:
  | null
  | undefined
  | {
      findWindowW: K;
      getWindowRect: K;
      isIconic: K;
      isWindowVisible: K;
      setWindowPos: K;
      rectType: K;
    } = undefined;

function load(): typeof funcs {
  if (funcs !== undefined) return funcs;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const koffi = require("koffi") as K;
    const u = koffi.load("user32.dll");
    const rectType = koffi.struct("ForkRect", {
      left: "long",
      top: "long",
      right: "long",
      bottom: "long",
    });
    funcs = {
      findWindowW: u.func("__stdcall", "ForkFindWindowW", "intptr_t", "str16", "str16"),
      getWindowRect: u.func("__stdcall", "ForkGetWindowRect", "_Bool", "intptr_t", rectType),
      isIconic: u.func("__stdcall", "ForkIsIconic", "_Bool", "intptr_t"),
      isWindowVisible: u.func("__stdcall", "ForkIsWindowVisible", "_Bool", "intptr_t"),
      setWindowPos: u.func(
        "__stdcall",
        "ForkSetWindowPos",
        "_Bool",
        "intptr_t",
        "intptr_t",
        "int",
        "int",
        "int",
        "int",
        "uint32",
      ),
      rectType,
    };
  } catch {
    funcs = null;
  }
  return funcs;
}

export function isWin32BridgeAvailable(): boolean {
  return load() !== null;
}

function hwndByTitle(title: string): number {
  const f = load();
  if (!f) return 0;
  try {
    return Number(f.findWindowW(null, title) ?? 0);
  } catch {
    return 0;
  }
}

/** Full frame-rect bounds by top-level window title, or MISSING bounds. */
export function getWindowBoundsByTitle(title: string): WindowBounds {
  const f = load();
  if (!f) return MISSING_WINDOW_BOUNDS;
  const hwnd = hwndByTitle(title);
  if (!hwnd) return MISSING_WINDOW_BOUNDS;
  try {
    const r = new f.rectType();
    if (!f.getWindowRect(hwnd, r)) return MISSING_WINDOW_BOUNDS;
    const left = Number(r.left);
    const top = Number(r.top);
    const width = Math.max(0, Number(r.right) - left);
    const height = Math.max(0, Number(r.bottom) - top);
    return {
      x: left,
      y: top,
      width,
      height,
      windowX: left,
      windowY: top,
      windowWidth: width,
      windowHeight: height,
      clientX: left,
      clientY: top,
      clientWidth: width,
      clientHeight: height,
      titleBarHeight: 0,
      isMinimized: !!f.isIconic(hwnd),
      isVisible: !!f.isWindowVisible(hwnd),
    };
  } catch {
    return MISSING_WINDOW_BOUNDS;
  }
}

/** Insert the overlay immediately above the game window in z-order. */
export function placeOverlayAboveGame(overlayHwndNumber: number, gameTitle: string): boolean {
  const f = load();
  if (!f || !overlayHwndNumber) return false;
  const gameHwnd = hwndByTitle(gameTitle);
  if (!gameHwnd) return false;
  try {
    // SWP_NOMOVE|SWP_NOSIZE|SWP_NOACTIVATE = 0x0001|0x0002|0x0010
    return !!f.setWindowPos(overlayHwndNumber, gameHwnd, 0, 0, 0, 0, 0x13);
  } catch {
    return false;
  }
}
