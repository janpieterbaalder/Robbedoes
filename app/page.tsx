import Scout from "@/components/scout";
import { authConfigured } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <Scout
      accountsEnabled={authConfigured() && Boolean(process.env.DATABASE_URL)}
    />
  );
}
