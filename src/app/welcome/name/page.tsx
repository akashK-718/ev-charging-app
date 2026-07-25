import { redirect } from 'next/navigation';

export default function WelcomeNamePage() {
  redirect('/auth');
}
