import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { billing, session } = await authenticate.admin(request);

  // Verify billing was successful
  const billingCheck = await billing.check({
    plans: ["starter", "growth", "scale"],
    isTest: true,
  });

  if (billingCheck?.hasActivePayment) {
    // Success! Redirect to app
    return redirect("/app");
  }

  // Failed, redirect back to billing
  return redirect("/app/billing");
}