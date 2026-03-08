// Lazy-initialize Stripe so it reads process.env AFTER dotenv.config() runs
const getStripe = () => require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../config/db');

// Define Tier Prices (in cents for Stripe)
const TIER_PRICES = {
    "STARTER": 19900,
    "GROWTH": 29900,
    "ENTERPRISE": 49900
};

exports.createCheckoutSession = async (req, res) => {
    try {
        const { requirements, clientId, clientEmail, clientName } = req.body;
        const tier = requirements.selectedTier;

        if (!TIER_PRICES[tier]) {
            return res.status(400).json({ error: "Invalid protocol tier selected." });
        }

        // Log the service request first as pending_payment
        const newRequest = {
            clientId,
            clientName,
            clientEmail,
            requirements,
            status: 'pending_payment',
            createdAt: new Date().toISOString()
        };

        const docRef = await db.collection('serviceRequests').add(newRequest);

        // Create Stripe Checkout Session
        // In production, ensure CLIENT_URL is set in .env
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

        // Verify Stripe key exists
        if (!process.env.STRIPE_SECRET_KEY) {
            console.warn("⚠️ STRIPE_SECRET_KEY is missing. Mocking success for MVP.");
            // Just auto-approve if no stripe key is configured yet for local dev
            await db.collection('serviceRequests').doc(docRef.id).update({
                status: 'pending_admin_review'
            });
            return res.status(200).json({
                mockUrl: `${clientUrl}/dashboard?success=true&session_id=mock_session_123`
            });
        }

        const session = await getStripe().checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: clientEmail,
            client_reference_id: docRef.id,
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `Nexus ${tier} Protocol`,
                            description: `Monthly subscription for AI Marketing Automation`,
                        },
                        unit_amount: TIER_PRICES[tier],
                        recurring: {
                            interval: 'month',
                        },
                    },
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${clientUrl}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${clientUrl}/dashboard?canceled=true`,
            metadata: {
                serviceRequestId: docRef.id,
                clientId,
                tier
            }
        });

        res.status(200).json({ url: session.url });
    } catch (error) {
        console.error("Stripe Checkout Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// Optional: Webhook handler to listen to successful payments
exports.handleStripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = getStripe().webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        // Fulfill the purchase...
        const serviceRequestId = session.metadata.serviceRequestId;
        if (serviceRequestId) {
            await db.collection('serviceRequests').doc(serviceRequestId).update({
                status: 'pending_admin_review',
                paymentStatus: 'paid',
                stripeSubscriptionId: session.subscription,
                paidAt: new Date().toISOString()
            });
        }
    }

    // Return a 200 response to acknowledge receipt of the event
    res.send();
};
