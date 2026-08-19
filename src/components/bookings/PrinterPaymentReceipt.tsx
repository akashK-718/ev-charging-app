"use client";

import { useEffect, useRef, useState } from "react";
import { ReceiptPrinter, type ReceiptPrinterStage } from "@/components/ui/ReceiptPrinter";
import type { PaymentData } from "@/components/bookings/PlainPaymentReceipt";

// Session-level cache — prevents re-animating on every re-render / polling tick
const seenBookings = new Set<string>();

type Props = {
  bookingId: string;
  chargerAddress: string;
  chargerName: string;
  confirmationCode: string;
  payment: PaymentData;
};

function formatAmountRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

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

function formatReceiptDate(iso: string): string {
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

export function PrinterPaymentReceipt({
  bookingId,
  chargerAddress,
  chargerName,
  confirmationCode,
  payment,
}: Props) {
  const alreadySeen = seenBookings.has(bookingId);
  const [stage, setStage] = useState<ReceiptPrinterStage>(
    alreadySeen ? "complete" : "processing",
  );
  // Track whether the printing animation has been triggered this mount
  const animationFiredRef = useRef(false);

  useEffect(() => {
    if (alreadySeen || animationFiredRef.current) return;
    animationFiredRef.current = true;

    // Brief processing frame, then feed the paper
    const printingTimer = setTimeout(() => {
      setStage("printing");
    }, 80);

    // 1.75s animation + 600ms settling buffer
    const completeTimer = setTimeout(() => {
      setStage("complete");
      seenBookings.add(bookingId);
    }, 80 + 1750 + 600);

    return () => {
      clearTimeout(printingTimer);
      clearTimeout(completeTimer);
    };
  }, [bookingId, alreadySeen]);

  const paymentMethod = formatPaymentMethod(
    payment.payment_method,
    payment.card_network,
    payment.card_last4,
  );

  return (
    <ReceiptPrinter.Root stage={stage}>
      <ReceiptPrinter.Machine>
        <ReceiptPrinter.Screen>
          <div className="space-y-3">
            {/* Charger info */}
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-white leading-tight truncate">
                {chargerName}
              </p>
              <p className="text-xs text-zinc-400 leading-tight line-clamp-2">
                {chargerAddress}
              </p>
            </div>

            {/* Amount */}
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-400">Amount paid</span>
              <span className="text-base font-bold text-white tabular-nums">
                {formatAmountRupees(payment.gross_amount)}
              </span>
            </div>

            <ReceiptPrinter.Status />
          </div>
        </ReceiptPrinter.Screen>
      </ReceiptPrinter.Machine>

      <ReceiptPrinter.Output>
        <ReceiptPrinter.Paper>
          {/* Receipt header */}
          <div className="mb-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Payment Receipt
            </p>
            <p className="text-[9px] text-zinc-400 mt-0.5">Kirin EV Charging</p>
          </div>

          <hr className="border-dashed border-zinc-300 mb-4" />

          {/* Amount — prominent */}
          <div className="text-center mb-4">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Total paid</p>
            <p className="text-2xl font-bold text-zinc-900 tabular-nums mt-0.5">
              {formatAmountRupees(payment.gross_amount)}
            </p>
          </div>

          <hr className="border-dashed border-zinc-300 mb-4" />

          {/* Details */}
          <dl className="space-y-2 text-[11px]">
            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500 shrink-0">Charger</dt>
              <dd className="text-zinc-800 font-medium text-right">{chargerName}</dd>
            </div>

            {paymentMethod && (
              <div className="flex justify-between gap-2">
                <dt className="text-zinc-500 shrink-0">Paid via</dt>
                <dd className="text-zinc-800 font-medium">{paymentMethod}</dd>
              </div>
            )}

            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500 shrink-0">Reference</dt>
              <dd className="text-zinc-800 font-mono text-[10px]">{confirmationCode}</dd>
            </div>

            <div className="flex justify-between gap-2">
              <dt className="text-zinc-500 shrink-0">Date</dt>
              <dd className="text-zinc-800">{formatReceiptDate(payment.created_at)}</dd>
            </div>
          </dl>

          {/* Razorpay IDs */}
          {(payment.razorpay_payment_id || payment.razorpay_order_id) && (
            <>
              <hr className="border-dashed border-zinc-300 my-4" />
              <div className="space-y-1.5">
                <p className="text-[9px] text-zinc-400 uppercase tracking-wider">
                  Reference (support)
                </p>
                {payment.razorpay_payment_id && (
                  <div className="flex justify-between gap-2 text-[9px]">
                    <span className="text-zinc-400 shrink-0">Payment ID</span>
                    <span className="font-mono text-zinc-500 text-right break-all">
                      {payment.razorpay_payment_id}
                    </span>
                  </div>
                )}
                {payment.razorpay_order_id && (
                  <div className="flex justify-between gap-2 text-[9px]">
                    <span className="text-zinc-400 shrink-0">Order ID</span>
                    <span className="font-mono text-zinc-500 text-right break-all">
                      {payment.razorpay_order_id}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          <hr className="border-dashed border-zinc-300 my-4" />

          {/* Download link */}
          <div className="text-center space-y-1">
            <a
              className="text-[10px] font-bold text-zinc-700 underline underline-offset-2 hover:text-zinc-900 transition-colors"
              href={`/api/bookings/${bookingId}/receipt`}
              rel="noopener noreferrer"
              target="_blank"
            >
              Download receipt PDF
            </a>
            <p className="text-[9px] text-zinc-400">Thank you for charging with Kirin.</p>
          </div>
        </ReceiptPrinter.Paper>
      </ReceiptPrinter.Output>
    </ReceiptPrinter.Root>
  );
}
