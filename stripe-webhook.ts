// Supabase Edge Function: supabase/functions/stripe-webhook/index.ts
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_...
// Stripe:  Developers > Webhooks > add endpoint
//          https://<project>.functions.supabase.co/stripe-webhook
//          events: checkout.session.completed, invoice.paid, customer.subscription.deleted
import Stripe from "https://esm.sh/stripe@14?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const iso = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString();

Deno.serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body, signature!, Deno.env.get("STRIPE_WEBHOOK_SECRET")!, undefined, cryptoProvider,
    );
  } catch (err) {
    return new Response(`Bad signature: ${(err as Error).message}`, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;           // set by the app (me.id)
      if (userId && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        await db.from("profiles").update({
          is_premium: true,
          premium_until: iso(sub.current_period_end),
          stripe_customer_id: session.customer as string,
        }).eq("id", userId);
      }
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const end = invoice.lines.data[0]?.period?.end;
      if (invoice.customer && end) {
        await db.from("profiles").update({ is_premium: true, premium_until: iso(end) })
          .eq("stripe_customer_id", invoice.customer as string);
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      await db.from("profiles").update({ is_premium: false, premium_until: new Date().toISOString() })
        .eq("stripe_customer_id", sub.customer as string);
    }
  } catch (err) {
    return new Response(`Handler error: ${(err as Error).message}`, { status: 500 });
  }
  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
