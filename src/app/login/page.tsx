import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getAdmin()) redirect("/");
  return <LoginForm />;
}
