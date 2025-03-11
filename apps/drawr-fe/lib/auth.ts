import { NextAuthOptions, Session, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { HTTP_BACKEND } from "@/config";
import axios from "axios";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accessToken: string;
    user: {
      id: string;
      email: string;
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
    async jwt({ token, user }: { token: JWT; user: User }) {
      if (user) {
        token.accessToken = user.token;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session) {
        session.accessToken = token.accessToken as string;
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
};
