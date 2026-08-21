import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import PDFDocument from 'pdfkit';
import { normalizeAddress } from '@/lib/utils';
import { formatCurrency } from '@/lib/pdf/format';

const NOTO_SANS_FONT = path.join(process.cwd(), 'public', 'fonts', 'NotoSans-Regular.ttf');

// Brand palette (matches globals.css tokens)
const INK    = '#1a1f1c';
const GREEN  = '#1c6b47';
const MUTED  = '#6b7269';
const BORDER = '#d5e0d8';

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

function formatDateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

function formatTimeRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' };
  const s = new Date(start).toLocaleTimeString('en-IN', opts);
  const e = new Date(end).toLocaleTimeString('en-IN', opts);
  const d = new Date(start).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  const dur = h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`;
  return `${d}  ·  ${s} – ${e}  (${dur})`;
}

function formatPaymentMethod(method: string | null, network: string | null, last4: string | null): string | null {
  if (!method) return null;
  if (method === 'card' && network && last4) return `${network} •••• ${last4}`;
  if (method === 'card') return 'Card';
  if (method === 'upi') return 'UPI';
  if (method === 'wallet') return 'Wallet';
  if (method === 'netbanking') return 'Net Banking';
  return method.charAt(0).toUpperCase() + method.slice(1);
}

/**
 * GET /api/bookings/[id]/receipt
 *
 * Returns a PDF payment receipt for the booking. Only the booking's driver
 * can request this. Generated fresh on every request from source data —
 * no pre-generated artifact stored anywhere.
 *
 * Note: Razorpay Invoice objects are NOT used here. Razorpay's Invoice API
 * rejects order_id/payment_id on creation (confirmed in
 * investigate/razorpay-invoice-retroactive-state). Razorpay IDs appear on
 * the receipt as reference numbers only.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const adminSupabase = createAdminClient();

  const { data: booking } = await adminSupabase
    .from('bookings')
    .select('id, driver_id, charger_id, scheduled_start, scheduled_end, confirmation_code, created_at')
    .eq('id', params.id)
    .eq('driver_id', user.id)
    .single();

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const [chargerRes, paymentRes] = await Promise.all([
    adminSupabase.from('chargers').select('title, address').eq('id', booking.charger_id).single(),
    adminSupabase
      .from('payments')
      .select('gross_amount, razorpay_order_id, razorpay_payment_id, payment_method, card_network, card_last4, created_at')
      .eq('booking_id', booking.id)
      .maybeSingle(),
  ]);

  const charger = chargerRes.data;
  const payment = paymentRes.data;

  if (!payment) {
    return NextResponse.json({ error: 'Payment record not found for this booking' }, { status: 404 });
  }

  // ── Build PDF ──────────────────────────────────────────────────────────────
  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
  doc.registerFont('NotoSans', NOTO_SANS_FONT);

  const L = 60;   // left margin
  const R = 535;  // right edge
  const W = R - L;
  let y = 56;

  // ── Header ─────────────────────────────────────────────────────────────────
  // Wordmark — "Kirin" in brand green
  doc.fillColor(GREEN).fontSize(22).font('Helvetica-Bold');
  doc.text('Kirin', L, y, { lineBreak: false });

  // Issued date — right-aligned in same row
  const issuedLabel = `Issued ${formatDateOnly(payment.created_at)}`;
  doc.fillColor(MUTED).fontSize(9).font('Helvetica');
  doc.text(issuedLabel, L, y + 6, { width: W, align: 'right', lineBreak: false });

  y += 36;

  // ── Title ──────────────────────────────────────────────────────────────────
  doc.fillColor(INK).fontSize(17).font('Helvetica-Bold');
  doc.text('Payment Receipt', L, y);
  y += 30;

  // ── Top rule ───────────────────────────────────────────────────────────────
  doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(BORDER).stroke();
  y += 20;

  // ── Helper: two-column row ─────────────────────────────────────────────────
  function row(label: string, value: string, labelColor = MUTED, valueColor = INK, fontSize = 10) {
    doc.fillColor(labelColor).fontSize(fontSize).font('Helvetica');
    doc.text(label, L, y, { lineBreak: false });
    doc.fillColor(valueColor).fontSize(fontSize).font('Helvetica');
    doc.text(value, L, y, { width: W, align: 'right', lineBreak: false });
    y += 20;
  }

  function sectionHeading(title: string) {
    y += 4;
    doc.fillColor(INK).fontSize(9).font('Helvetica-Bold');
    doc.text(title.toUpperCase(), L, y, { characterSpacing: 0.8 });
    y += 14;
    doc.moveTo(L, y).lineTo(R, y).lineWidth(0.3).strokeColor(BORDER).stroke();
    y += 14;
  }

  // ── Booking section ────────────────────────────────────────────────────────
  sectionHeading('Booking');
  row('Reference', booking.confirmation_code ?? booking.id.slice(0, 8).toUpperCase());
  row('Charger', charger?.title ?? '—');
  if (charger?.address) {
    row('Address', normalizeAddress(charger.address));
  }
  row('Time slot', formatTimeRange(booking.scheduled_start, booking.scheduled_end));

  y += 4;

  // ── Payment section ────────────────────────────────────────────────────────
  sectionHeading('Payment');

  // Amount — larger, prominent
  doc.fillColor(MUTED).fontSize(10).font('Helvetica');
  doc.text('Amount paid', L, y, { lineBreak: false });
  // NotoSans: required for ₹ (U+20B9) — base-14 PDF fonts lack this glyph
  doc.fillColor(GREEN).fontSize(16).font('NotoSans');
  doc.text(formatCurrency(payment.gross_amount / 100), L, y - 3, { width: W, align: 'right', lineBreak: false });
  y += 24;

  const methodLabel = formatPaymentMethod(
    payment.payment_method,
    payment.card_network,
    payment.card_last4,
  );
  if (methodLabel) {
    row('Payment method', methodLabel);
  }

  row('Payment date', formatDatetime(payment.created_at));

  y += 8;

  // ── Reference IDs (muted, smaller) ────────────────────────────────────────
  doc.moveTo(L, y).lineTo(R, y).lineWidth(0.3).strokeColor(BORDER).stroke();
  y += 12;

  doc.fillColor(MUTED).fontSize(8).font('Helvetica');
  doc.text('The following IDs are Razorpay reference numbers for support and audit purposes.', L, y, { width: W });
  y += 18;

  if (payment.razorpay_payment_id) {
    doc.fillColor(MUTED).fontSize(8.5).font('Helvetica');
    doc.text('Payment ID', L, y, { lineBreak: false });
    doc.font('Helvetica').text(payment.razorpay_payment_id, L, y, { width: W, align: 'right', lineBreak: false });
    y += 16;
  }
  if (payment.razorpay_order_id) {
    doc.fillColor(MUTED).fontSize(8.5).font('Helvetica');
    doc.text('Order ID', L, y, { lineBreak: false });
    doc.text(payment.razorpay_order_id, L, y, { width: W, align: 'right', lineBreak: false });
    y += 16;
  }

  y += 16;

  // ── Bottom rule + footer ───────────────────────────────────────────────────
  doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(BORDER).stroke();
  y += 16;

  doc.fillColor(MUTED).fontSize(8).font('Helvetica');
  doc.text(
    'This is a payment receipt, not a tax invoice. For support, contact support@kirin.in',
    L, y, { width: W, align: 'center' },
  );

  doc.end();

  // ── Collect buffer ─────────────────────────────────────────────────────────
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', resolve);
    doc.on('error', reject);
  });

  const pdfBuffer = Buffer.concat(chunks);
  const filename = `kirin-receipt-${booking.confirmation_code ?? booking.id.slice(0, 8)}.pdf`;

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
