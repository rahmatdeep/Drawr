import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { HTTP_BACKEND } from "@/config";
import axios from "axios";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    userId: string;
    provider: string;
    user: {
      email: string;
      name: string;
    };
  }

  interface User {
    id: string;
    email: string;
    token: string;
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const response = await axios.post(
            `${HTTP_BACKEND}/signin`,
            credentials
          );
          return {
            id: response.data.userId,
            email: credentials?.email || "",
            token: response.data.token,
          };
        } catch (error) {
          if (axios.isAxiosError(error)) {
            if (error.response?.data.message === "Validation Failed") {
              const validationErrors = error.response.data.error;
              const errorMessages = Object.keys(validationErrors)
                .filter((key) => key !== "_errors")
                .map((key) => validationErrors[key]._errors)
                .flat()
                .join(", ");
              throw new Error(errorMessages);
            }
            throw new Error(
              error.response?.data.message || "Authentication failed"
            );
          }
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.accessToken = user.token;
        token.userId = user.id;
        token.provider = account?.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (session) {
        session.accessToken = token.accessToken as string;
        session.userId = token.userId as string;
        session.provider = token.provider as string;
      }
      return session;
    },
    async signIn(params) {
      const { user, account } = params;
      if (account?.provider === "google") {
        try {
          const response = await axios.post(`${HTTP_BACKEND}/google-auth`, {
            email: user.email,
            name: user.name,
            providerId: user.id,
          });

          user.token = response.data.token;
          user.id = response.data.userId;
          return true;
        } catch (error) {
          console.log("Google authentication error: ", error);
          return false;
        }
      }
      return true;
    },
  },
  pages: {
    signIn: "/signin",
  },
};
