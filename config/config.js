import "dotenv/config";

const required = [
  "DARAJA_CONSUMER_KEY",
  "DARAJA_CONSUMER_SECRET",
  "DARAJA_PASSKEY",
  "DARAJA_SHORTCODE",
  "DARAJA_TILL",
  "CALLBACK_URL"
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing environment variable: ${key}`);
  }
}

if (!process.env.CALLBACK_URL.startsWith("https://")) {
  throw new Error("CALLBACK_URL must use HTTPS");
}

const sandbox = process.env.DARAJA_ENV !== "production";

export const config = {
  port: Number(process.env.PORT || 5000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  darajaBaseUrl: sandbox
    ? "https://sandbox.safaricom.co.ke"
    : "https://api.safaricom.co.ke",
  consumerKey: process.env.DARAJA_CONSUMER_KEY,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET,
  passkey: process.env.DARAJA_PASSKEY,
  shortcode: process.env.DARAJA_SHORTCODE,
  till: process.env.DARAJA_TILL,
  transactionType:
    process.env.DARAJA_TRANSACTION_TYPE || "CustomerPayBillOnline",
  callbackUrl: process.env.CALLBACK_URL,
  environment: sandbox ? "sandbox" : "production"
};

if (!sandbox && process.env.NODE_ENV !== "production") {
  throw new Error(
    "Production Daraja requires NODE_ENV=production"
  );
}