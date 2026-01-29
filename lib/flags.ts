import { unstable_flag as flag } from '@vercel/flags/next';

/**
 * Feature flag to control signup access during beta.
 * When false (default): Only existing users can sign in
 * When true: New users can sign up
 */
export const allowSignupFlag = flag<boolean>({
  key: 'allowSignup',
  defaultValue: false,
  description: 'Controls whether new users can sign up. Disabled during beta to restrict access to whitelisted users only.',
  origin: 'https://vercel.com/docs/feature-flags',
  options: [
    { value: false, label: 'Disabled (Beta - Sign in only)' },
    { value: true, label: 'Enabled (Public signups)' },
  ],
});
