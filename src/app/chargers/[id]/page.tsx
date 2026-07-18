import { redirect } from 'next/navigation';

export default function ChargerDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/explore/${params.id}`);
}
