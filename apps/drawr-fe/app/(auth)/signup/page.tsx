import { AuthPage } from "@/components/AuthPage";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function Signup() {
    const session = await getServerSession(authOptions);

    if (session) {
      redirect("/dashboard");
    }
  return <AuthPage isSignin={false} />;
}
