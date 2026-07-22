import { usePageLoader } from '../hooks/usePageLoader';

/**
 * While mounted, keeps the global PhD Manager logo spinner visible.
 * Used instead of Access Denied during auth / permission checks.
 */
export default function CheckingAccess() {
  usePageLoader(true);
  return null;
}
