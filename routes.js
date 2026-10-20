
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "./config/firebase.js";
import { initiateStkPush } from "./daraja.js";

const router = Router();
const payments = db.collection("payments");

function normalizePhone(value) {
  const phone = String(value || "").replace(/[\s-]/g, "");

  if (/^0[17]\d{8}$/.test(phone)) {
    return "254" + phone.slice(1);
  }

  if (/^\+254[17]\d{8}$/.test(phone)) {
    return phone.slice(1);
  }

  if (/^254[17]\d{8}$/.test(phone)) {
    return phone;
  }

  return null;
}

router.post("/mpesa/stkpush", async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const amount = Number(req.body.amount);

    if (!phone) {
      return res.status(400).json({
        error: "Enter a valid Kenyan mobile number."
      });
    }

    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 150000) {
      return res.status(400).json({
        error: "Amount must be a whole number between KSh 1 and 150,000."
      });
    }

    // This demo accepts the amount directly from the client.
    // A production checkout must calculate it from a trusted order
    // stored on the server, not trust the browser.
    const paymentId = randomUUID();

    await payments.doc(paymentId).set({
      paymentId,
      phone,
      amount,
      status: "initiating",
      createdAt: new Date().toISOString()
    });

    let result;

    try {
      result = await initiateStkPush({
        phone,
        amount,
        accountReference: `CP${paymentId.replaceAll("-", "").slice(0, 10)}`
      });
    } catch (error) {
      await payments.doc(paymentId).update({
        status: "request_error",
        updatedAt: new Date().toISOString()
      });

      throw error;
    }

    if (result.ResponseCode !== "0") {
      await payments.doc(paymentId).update({
        status: "request_rejected",
        darajaDescription: result.ResponseDescription || "Request rejected",
        updatedAt: new Date().toISOString()
      });

      return res.status(502).json({
        error: "Daraja did not accept the STK Push request."
      });
    }

    await payments.doc(paymentId).update({
      status: "pending",
      merchantRequestId: result.MerchantRequestID || null,
      checkoutRequestId: result.CheckoutRequestID || null,
      updatedAt: new Date().toISOString()
    });

    return res.status(202).json({
      paymentId,
      status: "pending",
      message: "STK Push requested. Check your phone and enter your PIN."
    });
  } catch (error) {
    console.error(
      "STK Push error:",
      error.response?.data || error.message
    );

    return res.status(502).json({
      error: "Unable to start payment. Check the backend logs."
    });
  }
});

router.post("/mpesa/callback", async (req, res) => {
  // Acknowledge the callback request after processing it.
  try {
    const callback = req.body?.Body?.stkCallback;

    if (!callback?.CheckoutRequestID) {
      return res.status(400).json({
        ResultCode: 1,
        ResultDesc: "Invalid callback payload"
      });
    }

    const snapshot = await payments
      .where("checkoutRequestId", "==", callback.CheckoutRequestID)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const existing = doc.data();

      // Do not let duplicate callbacks overwrite an already-final status.
      if (!["success", "failed"].includes(existing.status)) {
        const resultCode = Number(callback.ResultCode);
        const success = resultCode === 0;

        const items =
          callback.CallbackMetadata?.Item || [];

        const metadata = Object.fromEntries(
          items.map((item) => [item.Name, item.Value])
        );

        // Never mark a payment successful unless callback amount and
        // phone also match the transaction that was requested.
        const matches =
          success &&
          Number(metadata.Amount) === Number(existing.amount) &&
          String(metadata.PhoneNumber) === String(existing.phone) &&
          Boolean(metadata.MpesaReceiptNumber);

        await doc.ref.update({
          status: success && matches ? "success" : "failed",
          resultCode,
          resultDescription: String(callback.ResultDesc || ""),
          receiptNumber: success
            ? String(metadata.MpesaReceiptNumber || "")
            : null,
          transactionDate: metadata.TransactionDate
            ? String(metadata.TransactionDate)
            : null,
          updatedAt: new Date().toISOString()
        });
      }
    } else {
      console.warn(
        "Callback received for unknown CheckoutRequestID:",
        callback.CheckoutRequestID
      );
    }

    return res.json({
      ResultCode: 0,
      ResultDesc: "Accepted"
    });
  } catch (error) {
    console.error("Callback processing error:", error.message);

    return res.status(500).json({
      ResultCode: 1,
      ResultDesc: "Callback processing failed"
    });
  }
});

router.get("/payments/:paymentId", async (req, res) => {
  try {
    const doc = await payments.doc(req.params.paymentId).get();

    if (!doc.exists) {
      return res.status(404).json({
        error: "Payment not found."
      });
    }

    const payment = doc.data();

    // Public demo endpoint: do not expose sensitive transaction fields.
    return res.json({
      paymentId: payment.paymentId,
      status: payment.status,
      amount: payment.amount,
      receiptNumber:
        payment.status === "success" ? payment.receiptNumber : null
    });
  } catch {
    return res.status(500).json({
      error: "Unable to check payment status."
    });
  }
});

export default router;
