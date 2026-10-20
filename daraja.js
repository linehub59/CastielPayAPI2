
import axios from "axios";
import { Buffer } from "node:buffer";
import { config } from "./config/config.js";

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const credentials = Buffer.from(
    `${config.consumerKey}:${config.consumerSecret}`
  ).toString("base64");

  const response = await axios.get(
    `${config.darajaBaseUrl}/oauth/v1/generate`,
    {
      params: { grant_type: "client_credentials" },
      headers: {
        Authorization: `Basic ${credentials}`
      },
      timeout: 20000
    }
  );

  cachedToken = response.data.access_token;
  tokenExpiresAt =
    Date.now() +
    (Number(response.data.expires_in || 3600) - 60) * 1000;

  return cachedToken;
}

function getTimestamp() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return (
    values.year +
    values.month +
    values.day +
    values.hour +
    values.minute +
    values.second
  );
}

export async function initiateStkPush({
  phone,
  amount,
  accountReference
}) {
  const token = await getAccessToken();
  const timestamp = getTimestamp();

  const password = Buffer.from(
    config.shortcode + config.passkey + timestamp
  ).toString("base64");

  const payload = {
    BusinessShortCode: config.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: config.transactionType,
    Amount: amount,
    PartyA: phone,
    PartyB: config.till,
    PhoneNumber: phone,
    CallBackURL: config.callbackUrl,
    AccountReference: accountReference.slice(0, 12),
    TransactionDesc: "Castiel Pay"
  };

  const response = await axios.post(
    `${config.darajaBaseUrl}/mpesa/stkpush/v1/processrequest`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      timeout: 30000
    }
  );

  console.log("Daraja STK response:", {
  ResponseCode: response.data?.ResponseCode,
  ResponseDescription: response.data?.ResponseDescription,
  CustomerMessage: response.data?.CustomerMessage,
  CheckoutRequestID: response.data?.CheckoutRequestID
});

  return response.data;
}
