import { generateId } from "@/utils/generateId";

// Guest user interface
export interface GuestUser {
  id: number;
  username: string;
  createdAt: number;
}

// Check if a guest user exists in local storage
export function getGuestUser(): GuestUser | null {
  if (typeof window === "undefined") return null;

  const guestUser = localStorage.getItem("guestUser");
  return guestUser ? JSON.parse(guestUser) : null;
}

// Create a new guest user
export function createGuestUser(): GuestUser {
  const guestId = generateId();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const guestUser: GuestUser = {
    id: guestId,
    username: `Guest${randomNum}`,
    createdAt: Date.now(),
  };

  localStorage.setItem("guestUser", JSON.stringify(guestUser));
  return guestUser;
}

// Get or create a guest user
export function getOrCreateGuestUser(): GuestUser {
  const existingUser = getGuestUser();
  if (existingUser) return existingUser;

  return createGuestUser();
}

// Remove guest user data
export function clearGuestUser(): void {
  localStorage.removeItem("guestUser");
}

// Get guest canvas data
export function getGuestCanvasData(): string | null {
  return localStorage.getItem("guestCanvasData");
}

// Clear guest canvas data
export function clearGuestCanvasData(): void {
  localStorage.removeItem("guestCanvasData");
}

// Clear all guest data
export function clearAllGuestData(): void {
  clearGuestUser();
  clearGuestCanvasData();
}

// Export drawings from local storage
export function exportDrawingsFromLocalStorage() {
  const drawingsData = localStorage.getItem("guestCanvasData");
  if (!drawingsData) return [];

  try {
    return JSON.parse(drawingsData);
  } catch (e) {
    console.error("Error parsing drawings from local storage:", e);
    return [];
  }
}
