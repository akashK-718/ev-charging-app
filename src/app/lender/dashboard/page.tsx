import { redirect } from 'next/navigation';

export default function LenderDashboardRedirect() {
  redirect('/lender/chargers');
}
