import { getSession } from "@/src/lib/auth/session";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getSession();
  redirect(session ? "/dashboard" : "/login");
}
