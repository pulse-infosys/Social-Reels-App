import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useNavigate } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Frame,
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Button,
  ProgressBar,
} from "@shopify/polaris";
import { useState } from "react";

/* ========================= LOADER ========================= */

export async function loader({ request }) {
  const { billing } = await authenticate.admin(request);

  const billingCheck = await billing.check({
    plans: ["starter", "growth", "scale"],
    isTest: process.env.NODE_ENV !== "production",
  });


  const hasActiveSubscription = !!billingCheck?.hasActivePayment;


  let billedPlan = billingCheck?.plan ?? null;


  if (!billedPlan && Array.isArray(billingCheck?.appSubscriptions)) {
    const activeSub = billingCheck.appSubscriptions.find(
      (sub) => sub.status === "ACTIVE"
    );
    if (activeSub?.name) {
      billedPlan = activeSub.name; // 'starter' | 'growth' | 'scale'
    }
  }

 
  const currentPlan =
    hasActiveSubscription && billedPlan ? billedPlan : "free";


  const usedViews = 150;
  const remainingViews = 150;
  const usagePercent = 50;

  return json({
    currentPlan,              
    hasActiveSubscription,
    usedViews,
    remainingViews,
    usagePercent,
  });
}

/* ========================= ACTION ========================= */

export async function action({ request }) {
  const { billing, redirect, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const plan = formData.get("plan"); // 'free' | 'starter' | 'growth' | 'scale'

  if (!plan) {
    return json({ success: false, error: "Plan is required" }, { status: 400 });
  }


  if (plan === "free") {
    const billingCheck = await billing.check({
      plans: ["starter", "growth", "scale"],
      isTest: process.env.NODE_ENV !== "production",
    });

    const activeSub = billingCheck?.appSubscriptions?.find(
      (sub) => sub.status === "ACTIVE"
    );

    if (!activeSub) {
      return json({ success: true, downgraded: false });
    }

    const CANCEL_MUTATION = `
      mutation AppSubscriptionCancel($id: ID!, $prorate: Boolean!) {
        appSubscriptionCancel(id: $id, prorate: $prorate) {
          appSubscription {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const resp = await admin.graphql(CANCEL_MUTATION, {
      variables: { id: activeSub.id, prorate: true },
    });
    const result = await resp.json();

    const cancel = result?.data?.appSubscriptionCancel;
    const errors = cancel?.userErrors || [];

    if (errors.length) {
      console.error("AppSubscriptionCancel errors", errors);
      return json(
        {
          success: false,
          error: errors.map((e) => e.message).join(", "),
        },
        { status: 400 }
      );
    }

    return json({ success: true, downgraded: true });
  }


  const billingRequest = await billing.request({
    plan, // 'starter' | 'growth' | 'scale'
    isTest: process.env.NODE_ENV !== "production",
  });

  return redirect(billingRequest.confirmationUrl);
}

/* ========================= COMPONENT ========================= */

export default function Billing() {
  const {
    currentPlan,
    hasActiveSubscription,
    usedViews,
    remainingViews,
    usagePercent,
  } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();


  const subscribingPlan =
    fetcher.state !== "idle" ? fetcher.formData?.get("plan") : null;

  const plans = [
    {
      id: "free",
      name: "Free",
      price: "Free",
      features: [
        "Includes 550 video views/month",
        "All app features",
        "Slack and email support",
      ],
      isCurrent: currentPlan === "free",
    },
    {
      id: "starter",
      name: "Starter",
      price: "$9",
      features: [
        "Includes 3000 video views/month",
        "No limit on uploading videos!",
        "Add videos to any page",
        "1 latest card template",
        "Email support",
      ],
      isCurrent: currentPlan === "starter",
    },
    {
      id: "growth",
      name: "Growth",
      price: "$19",
      features: [
        "Includes 7000 video views/month",
        "No limit on uploading videos",
        "Add videos to any page",
        "2 latest card templates",
        "Slack and email support",
      ],
      isCurrent: currentPlan === "growth",
    },
    {
      id: "scale",
      name: "Scale",
      price: "$29",
      features: [
        "Includes 12000 video views/month",
        "No limit on uploading videos",
        "Add videos to any page",
        "2 latest card templates",
        "1 latest carousel template",
        "Slack and email support",
      ],
      isCurrent: currentPlan === "scale",
    },
  ];

  const handleSubscribe = (planId) => {
    const fd = new FormData();
    fd.append("plan", planId);
    fetcher.submit(fd, { method: "post" }); 
  };

  return (
    <Frame>
      <Page
        title="Billing"
        backAction={{ content: "Back", onAction: () => navigate("/app") }}
      >
        <Layout>
          {/* ===== Usage bar card ===== */}
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="100" blockAlign="center">
                    <Text variant="bodyMd" fontWeight="semibold">
                      {usedViews} views
                    </Text>
                    <Text tone="subdued" variant="bodySm">
                      (12 Dec – 1 Jan)
                    </Text>
                  </InlineStack>
                  <Text variant="bodySm" tone="subdued">
                    {remainingViews} views remaining
                  </Text>
                </InlineStack>

                <ProgressBar progress={usagePercent} size="medium" />

                <Text variant="bodySm" tone="subdued">
                  Views includes views from your current plan and additional
                  purchased views.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* ===== Plans row ===== */}
          <Layout.Section>
            <InlineStack gap="300" wrap={false}>
              {plans.map((plan) => {
                const isFree = plan.id === "free";
                const isCurrent = plan.isCurrent;

                return (
                  <Card
                    key={plan.id}
                    sectioned
                    roundedAbove="sm"
                    subdued={isCurrent}
                  >
                    <BlockStack gap="300">
                      {/* Title + badge */}
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="headingMd" as="h3">
                          {plan.name}
                        </Text>
                        {isCurrent && <Badge tone="info">Current plan</Badge>}
                      </InlineStack>

                      {/* Price */}
                      <Text variant="headingXl" as="p">
                        {isFree ? "Free" : plan.price}
                        {!isFree && (
                          <Text variant="bodySm" as="span">
                            {" "}
                            / Month
                          </Text>
                        )}
                      </Text>

                      {/* Features */}
                      <BlockStack gap="050">
                        {plan.features.map((feature, idx) => (
                          <Text key={idx} variant="bodySm">
                            • {feature}
                          </Text>
                        ))}
                      </BlockStack>

                      {/* Button */}
                      {isFree ? (
                        <Button
                          fullWidth
                          primary={!isCurrent}
                          disabled={isCurrent}
                          loading={subscribingPlan === plan.id}
                          onClick={() => {
                            if (!isCurrent) handleSubscribe(plan.id);
                          }}
                          variant="primary"
                        >
                          {isCurrent ? "Current Plan" : "Switch to Free"}
                        </Button>
                      ) : (
                        <Button
                          fullWidth
                          primary={!isCurrent}
                          disabled={isCurrent}
                          loading={subscribingPlan === plan.id}
                          onClick={() => handleSubscribe(plan.id)}
                          variant="primary"
                        >
                          {isCurrent ? "Current Plan" : "Subscribe"}
                        </Button>
                      )}
                    </BlockStack>
                  </Card>
                );
              })}
            </InlineStack>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}