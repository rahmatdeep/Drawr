/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@repo/ui/button";
import Link from "next/link";
import { HTTP_BACKEND } from "@/config";
import axios from "axios";
import {
  getGuestUser,
  clearAllGuestData,
  exportDrawingsFromLocalStorage,
} from "@/utils/guestUser";

export function AuthPage({ isSignin }: { isSignin: boolean }) {
  const [error, setError] = useState<string>("");
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const searchParams = useSearchParams();
  const fromGuest = searchParams.get("from") === "guest";
  const [guestData, setGuestData] = useState<any>(null);

  // Check if user is coming from guest mode
  useEffect(() => {
    if (fromGuest) {
      const guestUser = getGuestUser();
      if (guestUser) {
        setGuestData(guestUser);
      }
    }
  }, [fromGuest]);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!isSignin) {
      try {
        const signupData = {
          email,
          password,
          username: email.split("@")[0],
        };

        await axios.post(`${HTTP_BACKEND}/signup`, signupData);
        // After successful signup, sign in
        await signInUser(email, password);
      } catch (error: any) {
        setIsPending(false);
        if (error.response?.data.message === "Validation Failed") {
          const validationErrors = error.response.data.error;
          const errorMessages = Object.keys(validationErrors)
            .filter((key) => key !== "_errors")
            .map((key) => validationErrors[key]._errors)
            .flat()
            .join(", ");
          setError(errorMessages);
        } else {
          setError(error.response?.data.message || "Signup failed");
        }
      }
    } else {
      try {
        await signInUser(email, password);
      } catch {
        setIsPending(false);
      }
    }
  };

  const signInUser = async (email: string, password: string) => {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError(result.error);
      setIsPending(false);
    } else {
      // If coming from guest mode, redirect to the guest canvas
      if (fromGuest && guestData) {
        // Get the token from the session
        const session = await fetch("/api/auth/session").then((res) =>
          res.json()
        );
        if (session?.accessToken) {
          // Convert the guest room
          await convertGuestRoom(session.accessToken, guestData.id.toString());
          // Redirect to the guest canvas (which is now a regular room)
          router.push(`/canvas/guest-${guestData.id}`);
        } else {
          router.push("/dashboard");
        }
      } else {
        router.push("/dashboard");
      }
    }
  };

  const handleGoogleSignIn = async () => {
    const guestId = fromGuest && guestData ? guestData.id.toString() : null;
    const callbackUrl = guestId
      ? `/canvas/guest-${guestId}?convert=true`
      : "/dashboard";

    await signIn("google", { callbackUrl });
  };
  const convertGuestRoom = async (token: string, guestId: string) => {
    try {
      const convertResponse = await axios.post(
        `${HTTP_BACKEND}/convert-guest-room`,
        { guestId },
        { headers: { Authorization: token } }
      );
      const roomId = convertResponse.data.roomId;
      console.log("Converted room ID in auth:", roomId);

      // Get drawings from local storage
      const drawings = exportDrawingsFromLocalStorage();
      console.log("Importing drawings:", drawings);

      if (drawings.length > 0) {
        // Import drawings to the new
        await axios.post(
          `${HTTP_BACKEND}/import-guest-drawings`,
          {
            roomId,
            drawings,
          },
          { headers: { Authorization: token } }
        );
      }
      // Clear guest data after successful conversion
      clearAllGuestData();
    } catch (error) {
      console.error("Error converting guest room:", error);
    }
  };

  return (
    <div className="w-screen h-screen flex justify-center items-center bg-neutral-900">
      {fromGuest && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-lg text-white">
          {isSignin
            ? "Sign in to save your guest drawing"
            : "Sign up to save your guest drawing"}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <input
          type="hidden"
          name="type"
          value={isSignin ? "signin" : "signup"}
        />
        <div className="p-8 bg-black rounded-lg shadow-md w-96 border border-neutral-800">
          <h2 className="text-2xl font-bold text-center mb-6 text-white">
            {isSignin ? "Welcome Back" : "Create Account"}
          </h2>
          <div className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Email"
                name="email"
                className="w-full px-4 py-2 border border-neutral-700 rounded-md bg-neutral-900 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
                onChange={(e) => setError("")}
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Password"
                name="password"
                className="w-full px-4 py-2 border border-neutral-700 rounded-md bg-neutral-900 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
                onChange={(e) => setError("")}
              />
            </div>
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}

            <div className="pt-4">
              <Button
                variant="primary"
                size="lg"
                disabled={isPending}
                className="w-full bg-white text-black rounded-md hover:bg-neutral-100 transition-opacity"
              >
                {isPending
                  ? isSignin
                    ? "Signing in..."
                    : "Signing up..."
                  : isSignin
                    ? "Sign In"
                    : "Sign Up"}
              </Button>
            </div>
            <div className="relative flex items-center justify-center my-6">
              <div className="absolute w-full border-t border-neutral-700"></div>
              <div className="relative bg-black px-4">
                <span className="text-sm text-neutral-400">
                  or continue with
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-neutral-700 rounded-lg hover:bg-neutral-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span className="text-white font-medium">Google</span>
            </button>
            <div className="text-center text-sm text-neutral-400">
              {isSignin ? (
                <p>
                  Don&apos;t have an account?{" "}
                  <Link
                    href={fromGuest ? "/signup?from=guest" : "/signup"}
                    className="text-white hover:underline"
                  >
                    Sign up
                  </Link>
                </p>
              ) : (
                <p>
                  Already have an account?{" "}
                  <Link
                    href={fromGuest ? "/signin?from=guest" : "/signin"}
                    className="text-white hover:underline"
                  >
                    Sign in
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}