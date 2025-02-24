import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { HTTP_BACKEND } from "@/config";
import axios from "axios";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
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
export const authOptions = {
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
    async jwt({ token, user }: any) {
      if (user) {
        token.accessToken = user.token;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session) {
        session.accessToken = token.accessToken;
        session.userId = token.userId;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
};
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
