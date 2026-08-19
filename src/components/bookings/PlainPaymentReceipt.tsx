"use client";

import { ShieldCheck, Download } from "lucide-react";

export type PaymentData = {
  gross_amount: number;
  created_at: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  payment_method: string | null;
  card_network: string | null;
  card_last4: string | null;
};

type Props = {
  bookingId: string;
  confirmationCode: string;
  payment: PaymentData;
};

function formatPaymentMethod(
  method: string | null,
  network: string | null,
  last4: string | null,
): string | null {
  if (!method) return null;
  if (method === "card" && network && last4) return `${network} •••• ${last4}`;
  if (method === "card") return "Card";
  if (method === "upi") return "UPI";
  if (method === "wallet") return "Wallet";
  if (method === "netbanking") return "Net Banking";
  return method.charAt(0).toUpperCase() + method.slice(1);
}

function formatPaymentDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export function PlainPaymentReceipt({ bookingId, confirmationCode, payment }: Props) {
  const paymentMethod = formatPaymentMethod(
    payment.payment_method,
    payment.card_network,
    payment.card_last4,
  );

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm text-ink flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-volt-deep" />
          Payment Receipt
        </h2>
        <a
          className="flex items-center gap-1 text-xs font-semibold text-volt-deep hover:text-volt-deep/80 transition-colors"
          href={`/api/bookings/${bookingId}/receipt`}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </a>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted">Amount paid</span>
        <span className="text-lg font-semibold text-ink">
          ₹{(payment.gross_amount / 100).toLocaleString("en-IN")}
        </span>
      </div>

      {paymentMethod && (
        <div className="flex justify-between text-sm">
          <span className="text-muted">Payment method</span>
          <span className="text-ink font-medium">{paymentMethod}</span>
        </div>
      )}

      <div className="flex justify-between text-sm">
        <span className="text-muted">Booking reference</span>
        <span className="font-mono text-ink">{confirmationCode}</span>
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-muted">Payment date</span>
        <span className="text-ink">{formatPaymentDate(payment.created_at)}</span>
      </div>

      {(payment.razorpay_payment_id || payment.razorpay_order_id) && (
        <div className="pt-2 border-t border-gray-100 space-y-1.5">
          <p className="text-[10px] text-muted/70">Reference numbers (for support)</p>
          {payment.razorpay_payment_id && (
            <div className="flex justify-between text-xs">
              <span className="text-muted">Payment ID</span>
              <span className="font-mono text-muted">{payment.razorpay_payment_id}</span>
            </div>
          )}
          {payment.razorpay_order_id && (
            <div className="flex justify-between text-xs">
              <span className="text-muted">Order ID</span>
              <span className="font-mono text-muted">{payment.razorpay_order_id}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
