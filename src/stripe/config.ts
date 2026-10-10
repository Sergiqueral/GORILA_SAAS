import Stripe from "stripe";

const stripeKey = process.env.STRIPE_SECRET_KEY || "sk_test_placeholder_key";

export const stripe = new Stripe(stripeKey, {
  apiVersion: "2024-06-20",
});
