import { redirect } from 'next/navigation';

/** Legacy URL — product landing is now `/`. */
export default function PreSummaryRedirect() {
  redirect('/');
}
