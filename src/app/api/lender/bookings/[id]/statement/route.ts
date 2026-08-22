import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import PDFDocument from 'pdfkit';
import { normalizeAddress } from '@/lib/utils';
import { PLATFORM_COMMISSION_PERCENT } from '@/lib/constants';
import { formatCurrency } from '@/lib/pdf/format';

const NOTO_SANS_FONT = path.join(process.cwd(), 'public', 'fonts', 'NotoSans-Regular.ttf');

// Brand palette (matches globals.css tokens)
const INK    = '#1a1f1c';
const GREEN  = '#1c6b47';
const MUTED  = '#6b7269';
const BORDER = '#d5e0d8';

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

/**
 * GET /api/lender/bookings/[id]/statement
 *
 * Returns a PDF Host Earnings Statement for the booking. Only the booking's
 * lender can request this — entirely separate from the driver's Payment Receipt.
 * Generated fresh on every request; no pre-stored artifact.
 *
 * Note: "Tax Invoice" and "GST Invoice" are deliberately NOT produced here.
 * Kirin's tax/GST supplier position (marketplace vs. charging-service supplier)
 * requires accountant confirmation before any tax document is issued.
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

  // Lender-only: the .eq('lender_id', user.id) ensures drivers cannot access this.
  const { data: booking } = await adminSupabase
    .from('bookings')
    .select('id, lender_id, charger_id, scheduled_start, scheduled_end, confirmation_code, constraint_type, constraint_value')
    .eq('id', params.id)
    .eq('lender_id', user.id)
    .single();

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const [chargerRes, paymentRes] = await Promise.all([
    adminSupabase.from('chargers').select('title, address').eq('id', booking.charger_id).single(),
    adminSupabase
      .from('payments')
      .select('gross_amount, platform_fee, lender_payout, payout_released_at, razorpay_transfer_id, created_at')
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

  const L = 60;
  const R = 535;
  const W = R - L;
  let y = 56;

  // ── Header ─────────────────────────────────────────────────────────────────
  doc.fillColor(GREEN).fontSize(22).font('Helvetica-Bold');
  doc.text('Kirin', L, y, { lineBreak: false });

  const issuedLabel = `Issued ${formatDateOnly(payment.created_at)}`;
  doc.fillColor(MUTED).fontSize(9).font('Helvetica');
  doc.text(issuedLabel, L, y + 6, { width: W, align: 'right', lineBreak: false });

  y += 36;

  // ── Title ──────────────────────────────────────────────────────────────────
  doc.fillColor(INK).fontSize(17).font('Helvetica-Bold');
  doc.text('Host Earnings Statement', L, y);
  y += 30;

  // ── Top rule ───────────────────────────────────────────────────────────────
  doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(BORDER).stroke();
  y += 20;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function row(label: string, value: string, labelColor = MUTED, valueColor = INK, fontSize = 10, valueFont = 'Helvetica') {
    doc.fillColor(labelColor).fontSize(fontSize).font('Helvetica');
    doc.text(label, L, y, { lineBreak: false });
    doc.fillColor(valueColor).fontSize(fontSize).font(valueFont);
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

  // ── Session section ────────────────────────────────────────────────────────
  sectionHeading('Session');
  row('Booking reference', booking.confirmation_code ?? booking.id.slice(0, 8).toUpperCase());
  row('Charger', charger?.title ?? '—');
  if (charger?.address) {
    row('Address', normalizeAddress(charger.address));
  }
  row('Time slot', formatTimeRange(booking.scheduled_start, booking.scheduled_end));
  if (booking.constraint_type === 'budget' && booking.constraint_value != null) {
    row('Booked as', `Spend up to ₹${booking.constraint_value.toLocaleString('en-IN')}`, MUTED, MUTED, 9);
  }

  y += 4;

  // ── Earnings section ───────────────────────────────────────────────────────
  sectionHeading('Earnings');

  // NotoSans: required for ₹ (U+20B9) — base-14 PDF fonts lack this glyph
  row('Session total', formatCurrency(payment.gross_amount / 100), MUTED, INK, 10, 'NotoSans');
  row(`Platform fee (${PLATFORM_COMMISSION_PERCENT}%)`, `−${formatCurrency(payment.platform_fee / 100)}`, MUTED, MUTED, 10, 'NotoSans');

  // Divider before net
  doc.moveTo(L, y - 4).lineTo(R, y - 4).lineWidth(0.3).strokeColor(BORDER).stroke();

  // Net earnings — prominent in green
  doc.fillColor(MUTED).fontSize(10).font('Helvetica');
  doc.text('Your earnings', L, y, { lineBreak: false });
  // NotoSans: required for ₹ (U+20B9) — base-14 PDF fonts lack this glyph
  doc.fillColor(GREEN).fontSize(16).font('NotoSans');
  doc.text(formatCurrency(payment.lender_payout / 100), L, y - 3, { width: W, align: 'right', lineBreak: false });
  y += 28;

  // ── Payout section ─────────────────────────────────────────────────────────
  // Intentionally isolated: when RazorpayX payout wiring lands, replace the
  // contents of this block with real transfer data — nothing else changes.
  sectionHeading('Payout');

  if (payment.payout_released_at && payment.razorpay_transfer_id) {
    // Future state: real payout data wired in here once RazorpayX lands.
    row('Status', 'Paid out', MUTED, GREEN);
    row('Transfer date', formatDateOnly(payment.payout_released_at));
    row('Transfer reference', payment.razorpay_transfer_id, MUTED, MUTED);
  } else {
    // Current honest state — RazorpayX bank transfer wiring not yet complete.
    doc.fillColor(MUTED).fontSize(9).font('Helvetica');
    doc.text(
      'Payout processing — bank transfer integration in progress. Funds will be transferred to your registered bank account once payout processing is complete.',
      L, y, { width: W },
    );
    y += 36;
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  y += 8;
  doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(BORDER).stroke();
  y += 16;

  doc.fillColor(MUTED).fontSize(8).font('Helvetica');
  doc.text(
    'This is an earnings statement, not a tax invoice. For support, contact support@kirin.in',
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
  const code = booking.confirmation_code ?? booking.id.slice(0, 8);
  const filename = `kirin-earnings-${code}.pdf`;

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
