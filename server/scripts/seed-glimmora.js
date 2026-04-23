/*
 * Seeds the "Glimmora Team" project with a full set of test scenarios and
 * detailed test cases for the GlimmoraTeam Enterprise Workforce Intelligence
 * Platform (test env: https://test-gt.vercel.app).
 *
 * Idempotent: finds or creates the project, scenarios, and cases by name/title,
 * so re-running will not create duplicates. Updates existing cases' fields.
 *
 * Usage:
 *   node server/scripts/seed-glimmora.js
 */

const { v4: uuidv4 } = require('uuid');
const { initializeDatabase, getDb } = require('../database');

const PROJECT_NAME = 'Glimmora Team';
const PROJECT_DESCRIPTION =
  'Enterprise Workforce Intelligence Platform — QA (https://test-gt.vercel.app)';
const OWNER_EMAIL = 'vanshqalead@glimmora.com';
const PM_EMAIL = 'vanshqapm@glimmora.com';

const SCENARIOS = [
  {
    name: 'Authentication',
    description:
      'Sign-in flows: credentials, SSO (Google/Microsoft), validation, remember-me, callbacks, brute-force, and injection.',
    high_level: [
      'TS-AUTH-01 Verify user can sign in with valid email & password',
      'TS-AUTH-02 Verify sign-in fails with invalid credentials',
      'TS-AUTH-03 Verify Google SSO login flow',
      'TS-AUTH-04 Verify Microsoft SSO login flow',
      'TS-AUTH-05 Verify "Remember me" checkbox functionality',
      'TS-AUTH-06 Verify password show/hide (eye icon) toggle',
      'TS-AUTH-07 Verify email-field validation (format, required, length)',
      'TS-AUTH-08 Verify password-field validation (required, min length)',
      'TS-AUTH-09 Verify navigation to "Create an account" from login',
      'TS-AUTH-10 Verify callback URL redirect after successful login',
    ],
    cases: [
      {
        tcid: 'TC-AUTH-001',
        title: 'Sign in with valid email & password',
        preconditions: 'User has a registered account',
        steps:
          '1. Open /auth/login\n2. Enter valid email chaturanivansh21@gmail.com\n3. Enter valid password\n4. Click Sign In',
        expected: 'User is redirected to dashboard / callback URL',
        actual: 'Login successful, dashboard loads',
        status: 'Pass',
        priority: 'High',
        severity: 'Critical',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-AUTH-002',
        title: 'Sign in with invalid password',
        preconditions: 'Valid email registered',
        steps:
          '1. Open login page\n2. Enter valid email\n3. Enter wrong password\n4. Click Sign In',
        expected: 'Error message "Invalid credentials" shown',
        actual: 'Error displayed correctly',
        status: 'Pass',
        priority: 'High',
        severity: 'Major',
        case_type: 'Negative',
      },
      {
        tcid: 'TC-AUTH-003',
        title: 'Sign in with unregistered email',
        preconditions: 'App accessible',
        steps:
          '1. Enter unregistered email\n2. Enter any password\n3. Click Sign In',
        expected: 'Error message "Account not found"',
        actual: 'Error displayed',
        status: 'Pass',
        priority: 'Medium',
        severity: 'Major',
        case_type: 'Negative',
      },
      {
        tcid: 'TC-AUTH-004',
        title: 'Sign in with empty email',
        preconditions: 'Login page open',
        steps: '1. Leave email blank\n2. Enter password\n3. Click Sign In',
        expected: 'Validation "Email is required"',
        actual: 'Field validation fires',
        status: 'Pass',
        priority: 'Medium',
        severity: 'Minor',
        case_type: 'Negative',
      },
      {
        tcid: 'TC-AUTH-005',
        title: 'Sign in with empty password',
        preconditions: 'Login page open',
        steps: '1. Enter email\n2. Leave password blank\n3. Click Sign In',
        expected: 'Validation "Password is required"',
        actual: 'Field validation fires',
        status: 'Pass',
        priority: 'Medium',
        severity: 'Minor',
        case_type: 'Negative',
      },
      {
        tcid: 'TC-AUTH-006',
        title: 'Sign in with invalid email format',
        preconditions: 'Login page open',
        steps:
          '1. Enter abc@xyz (no TLD)\n2. Enter password\n3. Click Sign In',
        expected: 'Validation "Enter a valid email"',
        actual: 'Validation message appears',
        status: 'Pass',
        priority: 'Medium',
        severity: 'Minor',
        case_type: 'Negative',
      },
      {
        tcid: 'TC-AUTH-007',
        title: 'Password show/hide toggle',
        preconditions: 'Login page open',
        steps:
          '1. Enter password\n2. Click eye icon\n3. Click eye icon again',
        expected: 'Password text toggles visible ↔ hidden',
        actual: 'Toggle works',
        status: 'Pass',
        priority: 'Low',
        severity: 'Minor',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-AUTH-008',
        title: 'Remember me checkbox persists session',
        preconditions: 'Login page open',
        steps:
          '1. Check "Remember me"\n2. Sign in\n3. Close browser & reopen',
        expected: 'User remains logged in',
        actual: 'Session persists',
        status: 'Pass',
        priority: 'Medium',
        severity: 'Major',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-AUTH-009',
        title: 'Google SSO login',
        preconditions: 'Google account available',
        steps:
          '1. Click Google button\n2. Choose Google account\n3. Grant consent',
        expected: 'Redirects to dashboard authenticated',
        actual: 'OAuth flow completes',
        status: 'Pass',
        priority: 'High',
        severity: 'Major',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-AUTH-010',
        title: 'Microsoft SSO login',
        preconditions: 'Microsoft account available',
        steps:
          '1. Click Microsoft button\n2. Choose MS account\n3. Grant consent',
        expected: 'Redirects to dashboard authenticated',
        actual: 'OAuth flow completes',
        status: 'Pass',
        priority: 'High',
        severity: 'Major',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-AUTH-011',
        title: '"Forgot password?" link navigation',
        preconditions: 'Login page open',
        steps: '1. Click Forgot password?',
        expected: 'Navigates to /auth/forgot-password',
        actual: 'Redirect works',
        status: 'Pass',
        priority: 'Low',
        severity: 'Minor',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-AUTH-012',
        title: '"Create an account" link navigation',
        preconditions: 'Login page open',
        steps: '1. Click Create an account',
        expected: 'Navigates to /auth/register',
        actual: 'Redirect works',
        status: 'Pass',
        priority: 'Low',
        severity: 'Minor',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-AUTH-013',
        title: 'Callback URL redirect',
        preconditions: 'callbackUrl=/enterprise/sow present',
        steps: '1. Sign in with valid credentials',
        expected: 'User lands on /enterprise/sow after login',
        actual: 'Correct redirect',
        status: 'Pass',
        priority: 'Medium',
        severity: 'Major',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-AUTH-014',
        title: 'Brute-force attempt lock',
        preconditions: '5 consecutive failed logins',
        steps: '1. Enter wrong password 5 times',
        expected:
          'Account temporarily locked / captcha shown',
        actual: 'Lock triggers',
        status: 'Not Run',
        priority: 'High',
        severity: 'Critical',
        case_type: 'Edge',
      },
      {
        tcid: 'TC-AUTH-015',
        title: 'SQL injection in email',
        preconditions: 'Login page open',
        steps: "1. Enter ' OR 1=1 -- as email\n2. Click Sign In",
        expected: 'Input sanitized, login rejected',
        actual: 'No DB exposure',
        status: 'Pass',
        priority: 'Critical',
        severity: 'Critical',
        case_type: 'Edge',
      },
    ],
  },
  {
    name: 'Forgot Password / Account Recovery',
    description:
      'Password reset flow: send link, validation, expiry, reuse, rate-limit, and back navigation.',
    high_level: [
      'TS-PWD-01 Verify reset link is sent to a registered email',
      'TS-PWD-02 Verify error for unregistered email',
      'TS-PWD-03 Verify email format validation on reset form',
      'TS-PWD-04 Verify "Back to sign in" navigation works',
      'TS-PWD-05 Verify reset link expires after defined time',
      'TS-PWD-06 Verify multiple reset requests handling (rate-limit)',
    ],
    cases: [
      {
        tcid: 'TC-PWD-001',
        title: 'Send reset link to registered email',
        preconditions: 'Registered account exists',
        steps:
          '1. Open /auth/forgot-password\n2. Enter registered email\n3. Click Send Reset Link',
        expected: 'Success toast; reset email received',
        actual: 'Email delivered',
        status: 'Pass',
        priority: 'High',
        severity: 'Major',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-PWD-002',
        title: 'Send reset link to unregistered email',
        preconditions: 'Email not in DB',
        steps:
          '1. Enter unregistered email\n2. Click Send Reset Link',
        expected:
          'Generic message "If account exists, a link is sent"',
        actual: 'Security-safe response',
        status: 'Pass',
        priority: 'High',
        severity: 'Major',
        case_type: 'Negative',
      },
      {
        tcid: 'TC-PWD-003',
        title: 'Empty email field',
        preconditions: 'Page loaded',
        steps: '1. Leave blank\n2. Click Send Reset Link',
        expected: 'Validation "Email is required"',
        actual: 'Validation fires',
        status: 'Pass',
        priority: 'Medium',
        severity: 'Minor',
        case_type: 'Negative',
      },
      {
        tcid: 'TC-PWD-004',
        title: 'Invalid email format',
        preconditions: 'Page loaded',
        steps: '1. Enter abc@xyz\n2. Click Send Reset Link',
        expected: 'Validation "Enter a valid email"',
        actual: 'Validation fires',
        status: 'Pass',
        priority: 'Medium',
        severity: 'Minor',
        case_type: 'Negative',
      },
      {
        tcid: 'TC-PWD-005',
        title: 'Click "Back to sign in"',
        preconditions: 'Page loaded',
        steps: '1. Click Back to sign in',
        expected: 'Redirects to /auth/login',
        actual: 'Navigation works',
        status: 'Pass',
        priority: 'Low',
        severity: 'Minor',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-PWD-006',
        title: 'Reset link expiry',
        preconditions: 'Reset email received',
        steps:
          '1. Wait > expiry window (e.g. 30 min)\n2. Click link',
        expected: '"Link expired" error shown',
        actual: 'Link invalid',
        status: 'Pass',
        priority: 'High',
        severity: 'Major',
        case_type: 'Edge',
      },
      {
        tcid: 'TC-PWD-007',
        title: 'Reset link used twice',
        preconditions: 'Reset email received',
        steps: '1. Reset password once\n2. Reuse same link',
        expected: '"Link already used" error',
        actual: 'Prevented reuse',
        status: 'Pass',
        priority: 'High',
        severity: 'Major',
        case_type: 'Edge',
      },
      {
        tcid: 'TC-PWD-008',
        title: 'Multiple reset requests (rate-limit)',
        preconditions: 'Valid email',
        steps:
          '1. Click Send Reset Link 10 times in 1 min',
        expected: 'Rate-limit warning shown',
        actual: 'Blocked after N tries',
        status: 'Not Run',
        priority: 'High',
        severity: 'Major',
        case_type: 'Edge',
      },
    ],
  },
  {
    name: 'Registration (Account Type)',
    description:
      'Account-type selection: Contributor vs Enterprise, hover/active states, navigation, and benefits content.',
    high_level: [
      'TS-REG-01 Verify Contributor account type selection and flow',
      'TS-REG-02 Verify Enterprise account type selection and flow',
      'TS-REG-03 Verify UI highlights on hover / active selection',
      'TS-REG-04 Verify navigation from Register → Sign in',
      'TS-REG-05 Verify both cards display correct benefits/content',
    ],
    cases: [
      {
        tcid: 'TC-REG-001',
        title: 'Select Contributor account',
        preconditions: 'On /auth/register',
        steps: '1. Click Contributor card arrow',
        expected: 'Redirects to Contributor sign-up form',
        actual: 'Navigation works',
        status: 'Pass',
        priority: 'High',
        severity: 'Major',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-REG-002',
        title: 'Select Enterprise account',
        preconditions: 'On /auth/register',
        steps: '1. Click Enterprise card arrow',
        expected: 'Redirects to Enterprise sign-up form',
        actual: 'Navigation works',
        status: 'Pass',
        priority: 'High',
        severity: 'Major',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-REG-003',
        title: 'Hover states on both cards',
        preconditions: 'On register page',
        steps: '1. Hover Contributor card\n2. Hover Enterprise card',
        expected: 'Cards highlight / border-color changes',
        actual: 'UI responsive',
        status: 'Pass',
        priority: 'Low',
        severity: 'Minor',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-REG-004',
        title: '"Sign in" link from register',
        preconditions: 'On register page',
        steps: '1. Click Sign in at bottom',
        expected: 'Redirects to /auth/login',
        actual: 'Navigation works',
        status: 'Pass',
        priority: 'Low',
        severity: 'Minor',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-REG-005',
        title: 'Card benefits text accuracy',
        preconditions: 'On register page',
        steps:
          '1. Read Contributor benefits\n2. Read Enterprise benefits',
        expected: 'Benefits match product spec',
        actual: 'Content correct',
        status: 'Pass',
        priority: 'Low',
        severity: 'Minor',
        case_type: 'Positive',
      },
    ],
  },
  {
    name: 'Contributor Onboarding (4 Steps)',
    description:
      'Four-step onboarding: Identity, Profile, Verification (NDA + phone OTP), Consent (resume + agreements). Includes stepper, validation, and resume-on-relogin.',
    high_level: [
      'TS-ONB-01 Verify Step 1 – Identity (Basic info & role) submission',
      'TS-ONB-02 Verify Step 2 – Profile (Skills & availability) submission',
      'TS-ONB-03 Verify Step 3 – Verification NDA download & signed upload',
      'TS-ONB-04 Verify NDA file type / size validation',
      'TS-ONB-05 Verify NDA "I agree" legal-binding checkbox',
      'TS-ONB-06 Verify Step 3 – Phone number country code selection',
      'TS-ONB-07 Verify OTP send, valid-for-5-min display, and resend timer',
      'TS-ONB-08 Verify OTP verify with correct / incorrect code',
      'TS-ONB-09 Verify Step 4 – Consent (resume upload & agreements)',
      'TS-ONB-10 Verify stepper progress indicator updates correctly',
      'TS-ONB-11 Verify user cannot skip a step without completing it',
      'TS-ONB-12 Verify partially completed onboarding persists on re-login',
    ],
    cases: [
      {
        tcid: 'TC-ONB-001',
        title: 'Step 1 – Identity valid submission',
        preconditions: 'Logged in as new contributor',
        steps:
          '1. Fill Name, Role, Country\n2. Click Next',
        expected: 'Proceeds to Step 2 – Profile',
        actual: 'Step advances',
        status: 'Pass',
        priority: 'High',
        severity: 'Major',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-ONB-002',
        title: 'Step 1 – Missing required field',
        preconditions: 'On Identity step',
        steps: '1. Leave Name blank\n2. Click Next',
        expected: 'Error "Name is required"',
        actual: 'Validation fires',
        status: 'Pass',
        priority: 'Medium',
        severity: 'Minor',
        case_type: 'Negative',
      },
      {
        tcid: 'TC-ONB-003',
        title: 'Step 2 – Skills & availability',
        preconditions: 'On Profile step',
        steps:
          '1. Select skills\n2. Set availability\n3. Click Next',
        expected: 'Proceeds to Step 3 – Verification',
        actual: 'Step advances',
        status: 'Pass',
        priority: 'High',
        severity: 'Major',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-ONB-004',
        title: 'Step 3 – Download NDA',
        preconditions: 'On Verification step',
        steps: '1. Click Download NDA',
        expected: 'NDA PDF downloads to device',
        actual: 'File downloaded',
        status: 'Pass',
        priority: 'High',
        severity: 'Major',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-ONB-005',
        title: 'Step 3 – Upload signed NDA (valid PDF)',
        preconditions: 'NDA downloaded & signed',
        steps:
          '1. Click upload area\n2. Choose signed PDF',
        expected:
          'File accepted, green check shown, "Signed & uploaded · 23 April 2026"',
        actual: 'Upload succeeds',
        status: 'Pass',
        priority: 'High',
        severity: 'Major',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-ONB-006',
        title: 'Step 3 – Upload unsupported file type',
        preconditions: 'On Verification step',
        steps: '1. Upload .exe or .jpg',
        expected: 'Error "Only PDF allowed"',
        actual: 'Upload rejected',
        status: 'Pass',
        priority: 'Medium',
        severity: 'Major',
        case_type: 'Negative',
      },
      {
        tcid: 'TC-ONB-007',
        title: 'Step 3 – Upload oversized file (>10 MB)',
        preconditions: 'On Verification step',
        steps: '1. Upload very large PDF',
        expected: 'Error "File exceeds 10 MB limit"',
        actual: 'Upload rejected',
        status: 'Pass',
        priority: 'Medium',
        severity: 'Major',
        case_type: 'Edge',
      },
      {
        tcid: 'TC-ONB-008',
        title: 'Step 3 – Remove uploaded NDA',
        preconditions: 'NDA already uploaded',
        steps: '1. Click Remove',
        expected: 'File removed, upload zone resets',
        actual: 'UI resets',
        status: 'Pass',
        priority: 'Low',
        severity: 'Minor',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-ONB-009',
        title: 'Step 3 – Agree to NDA checkbox',
        preconditions: 'On Verification step',
        steps:
          '1. Tick "I have read and agree to be legally bound..."',
        expected: 'Checkbox checked, Next enabled',
        actual: 'Checkbox works',
        status: 'Pass',
        priority: 'High',
        severity: 'Major',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-ONB-010',
        title: 'Step 3 – Phone OTP send',
        preconditions: 'NDA uploaded',
        steps:
          '1. Enter phone +91 9301875546\n2. Click Verify OTP',
        expected:
          '"Code sent to +91 9301875546 · valid 5 min" message',
        actual: 'OTP sent',
        status: 'Pass',
        priority: 'High',
        severity: 'Major',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-ONB-011',
        title: 'Step 3 – Country code change',
        preconditions: 'Phone field empty',
        steps:
          '1. Click flag dropdown\n2. Pick another country',
        expected: 'Country code updates accordingly',
        actual: 'Selector works',
        status: 'Pass',
        priority: 'Medium',
        severity: 'Minor',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-ONB-012',
        title: 'Step 3 – Verify valid OTP',
        preconditions: 'OTP sent',
        steps:
          '1. Enter correct 6-digit OTP\n2. Click Verify',
        expected: 'Phone verified; proceed to Step 4',
        actual: 'Success',
        status: 'Pass',
        priority: 'High',
        severity: 'Major',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-ONB-013',
        title: 'Step 3 – Verify invalid OTP',
        preconditions: 'OTP sent',
        steps:
          '1. Enter random 6 digits\n2. Click Verify',
        expected: 'Error "Invalid OTP"',
        actual: 'Validation fires',
        status: 'Pass',
        priority: 'High',
        severity: 'Major',
        case_type: 'Negative',
      },
      {
        tcid: 'TC-ONB-014',
        title: 'Step 3 – Resend OTP timer',
        preconditions: 'OTP just sent',
        steps:
          '1. Wait for "Resend in 27s" to count down',
        expected: 'Resend enabled at 0s',
        actual: 'Timer works',
        status: 'Pass',
        priority: 'Medium',
        severity: 'Minor',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-ONB-015',
        title: 'Step 3 – OTP expiry (>5 min)',
        preconditions: 'OTP sent',
        steps: '1. Wait 6 min\n2. Enter valid OTP',
        expected: 'Error "OTP expired"',
        actual: 'Expiry enforced',
        status: 'Pass',
        priority: 'High',
        severity: 'Major',
        case_type: 'Edge',
      },
      {
        tcid: 'TC-ONB-016',
        title: 'Step 4 – Resume upload',
        preconditions: 'On Consent step',
        steps: '1. Upload resume PDF',
        expected: 'Resume uploaded',
        actual: 'Upload succeeds',
        status: 'Pass',
        priority: 'High',
        severity: 'Major',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-ONB-017',
        title: 'Step 4 – Accept all agreements',
        preconditions: 'Resume uploaded',
        steps:
          '1. Tick all consent checkboxes\n2. Click Finish',
        expected: 'Onboarding completed, dashboard loads',
        actual: 'Success',
        status: 'Pass',
        priority: 'High',
        severity: 'Critical',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-ONB-018',
        title: 'Step 4 – Missing agreement checkbox',
        preconditions: 'On Consent step',
        steps:
          '1. Leave one checkbox unchecked\n2. Click Finish',
        expected: 'Error "Please accept all agreements"',
        actual: 'Validation fires',
        status: 'Pass',
        priority: 'Medium',
        severity: 'Major',
        case_type: 'Negative',
      },
      {
        tcid: 'TC-ONB-019',
        title: 'Stepper progress indicator',
        preconditions: 'Mid-onboarding',
        steps:
          '1. Complete steps 1 & 2\n2. Observe stepper',
        expected:
          'Steps 1, 2 marked complete; Step 3 active',
        actual: 'Indicator accurate',
        status: 'Pass',
        priority: 'Low',
        severity: 'Minor',
        case_type: 'Positive',
      },
      {
        tcid: 'TC-ONB-020',
        title: 'Cannot skip to later step',
        preconditions: 'On Step 1',
        steps: '1. Try clicking Step 3 in stepper',
        expected: 'Step 3 is disabled / non-clickable',
        actual: 'Navigation blocked',
        status: 'Pass',
        priority: 'Medium',
        severity: 'Major',
        case_type: 'Negative',
      },
      {
        tcid: 'TC-ONB-021',
        title: 'Onboarding resumes on re-login',
        preconditions: 'Partially onboarded',
        steps:
          '1. Log out mid-onboarding\n2. Log back in',
        expected: 'Resumes from last incomplete step',
        actual: 'State persists',
        status: 'Pass',
        priority: 'High',
        severity: 'Major',
        case_type: 'Edge',
      },
    ],
  },
  {
    name: 'Dashboard & Navigation',
    description:
      'Sidebar links, search palette, notifications, avatar menu, logout, and sidebar collapse.',
    high_level: [
      'TS-DASH-01 Verify sidebar navigation links work (Dashboard, Tasks, Submissions, etc.)',
      'TS-DASH-02 Verify user profile section at bottom of sidebar',
      'TS-DASH-03 Verify global search bar (⌘K) functionality',
      'TS-DASH-04 Verify notification bell icon opens notifications',
      'TS-DASH-05 Verify sidebar collapse/expand icon works',
    ],
    cases: [
      { tcid: 'TC-DASH-001', title: 'Sidebar – Dashboard link', preconditions: 'Logged in', steps: '1. Click Dashboard', expected: 'Dashboard home view loads', actual: 'Navigation works', status: 'Pass', priority: 'Medium', severity: 'Major', case_type: 'Positive' },
      { tcid: 'TC-DASH-002', title: 'Sidebar – Tasks link', preconditions: 'Logged in', steps: '1. Click Tasks', expected: 'Tasks page loads', actual: 'Navigation works', status: 'Pass', priority: 'Medium', severity: 'Major', case_type: 'Positive' },
      { tcid: 'TC-DASH-003', title: 'Sidebar – Submissions link', preconditions: 'Logged in', steps: '1. Click Submissions', expected: 'Submissions page loads', actual: 'Navigation works', status: 'Pass', priority: 'Medium', severity: 'Major', case_type: 'Positive' },
      { tcid: 'TC-DASH-004', title: 'Sidebar – Earnings link', preconditions: 'Logged in', steps: '1. Click Earnings', expected: 'Earnings page loads', actual: 'Navigation works', status: 'Pass', priority: 'Medium', severity: 'Major', case_type: 'Positive' },
      { tcid: 'TC-DASH-005', title: 'Sidebar – Credentials link', preconditions: 'Logged in', steps: '1. Click Credentials', expected: 'Credentials page loads', actual: 'Navigation works', status: 'Pass', priority: 'Medium', severity: 'Major', case_type: 'Positive' },
      { tcid: 'TC-DASH-006', title: 'Sidebar – Learning link', preconditions: 'Logged in', steps: '1. Click Learning', expected: 'Learning page loads', actual: 'Navigation works', status: 'Pass', priority: 'Low', severity: 'Minor', case_type: 'Positive' },
      { tcid: 'TC-DASH-007', title: 'Sidebar – Support link', preconditions: 'Logged in', steps: '1. Click Support', expected: 'Support page loads', actual: 'Navigation works', status: 'Pass', priority: 'Low', severity: 'Minor', case_type: 'Positive' },
      { tcid: 'TC-DASH-008', title: 'Sidebar – Messages link', preconditions: 'Logged in', steps: '1. Click Messages', expected: 'Messages page loads', actual: 'Navigation works', status: 'Pass', priority: 'Low', severity: 'Minor', case_type: 'Positive' },
      { tcid: 'TC-DASH-009', title: 'Sidebar – Profile link', preconditions: 'Logged in', steps: '1. Click Profile', expected: 'Profile page loads', actual: 'Navigation works', status: 'Pass', priority: 'Low', severity: 'Minor', case_type: 'Positive' },
      { tcid: 'TC-DASH-010', title: 'Sidebar – Settings link', preconditions: 'Logged in', steps: '1. Click Settings', expected: 'Settings page loads', actual: 'Navigation works', status: 'Pass', priority: 'Low', severity: 'Minor', case_type: 'Positive' },
      { tcid: 'TC-DASH-011', title: 'Global search (⌘K) shortcut', preconditions: 'Logged in', steps: '1. Press Ctrl/⌘ + K', expected: 'Search palette opens', actual: 'Shortcut works', status: 'Pass', priority: 'Medium', severity: 'Minor', case_type: 'Positive' },
      { tcid: 'TC-DASH-012', title: 'Notification bell', preconditions: 'Logged in', steps: '1. Click bell icon', expected: 'Notifications dropdown opens', actual: 'Works', status: 'Pass', priority: 'Medium', severity: 'Minor', case_type: 'Positive' },
      { tcid: 'TC-DASH-013', title: 'User avatar menu', preconditions: 'Logged in', steps: '1. Click avatar at bottom-left', expected: 'Profile menu with Logout opens', actual: 'Menu works', status: 'Pass', priority: 'Medium', severity: 'Minor', case_type: 'Positive' },
      { tcid: 'TC-DASH-014', title: 'Logout', preconditions: 'Logged in', steps: '1. Open avatar menu\n2. Click Logout', expected: 'User logged out, redirected to login', actual: 'Logout works', status: 'Pass', priority: 'High', severity: 'Major', case_type: 'Positive' },
      { tcid: 'TC-DASH-015', title: 'Sidebar collapse', preconditions: 'Logged in', steps: '1. Click collapse icon', expected: 'Sidebar shrinks to icon-only view', actual: 'Toggle works', status: 'Pass', priority: 'Low', severity: 'Minor', case_type: 'Positive' },
    ],
  },
  {
    name: 'Tasks Page',
    description:
      'Task counts, empty state, search, filters (status/priority/time), sorting, row-click detail, combined filters, and reset.',
    high_level: [
      'TS-TASK-01 Verify task-count cards (Available, In Progress, Submitted, Completed)',
      'TS-TASK-02 Verify "No tasks found" empty state displays when zero tasks',
      'TS-TASK-03 Verify task search filter',
      'TS-TASK-04 Verify "All Status" filter dropdown',
      'TS-TASK-05 Verify "All Priority" filter dropdown',
      'TS-TASK-06 Verify "All Time" filter dropdown',
      'TS-TASK-07 Verify task-list column sorting (Match, Due Date, Effort)',
    ],
    cases: [
      { tcid: 'TC-TASK-001', title: 'Task count cards display', preconditions: 'On Tasks page', steps: '1. Observe Available/In Progress/Submitted/Completed cards', expected: 'Counts match backend data', actual: 'Counts correct', status: 'Pass', priority: 'Medium', severity: 'Major', case_type: 'Positive' },
      { tcid: 'TC-TASK-002', title: 'Empty state when zero tasks', preconditions: 'User has no tasks', steps: '1. Scroll to All Tasks table', expected: '"No tasks found" + icon + helper text shown', actual: 'Empty state visible', status: 'Pass', priority: 'Low', severity: 'Minor', case_type: 'Edge' },
      { tcid: 'TC-TASK-003', title: 'Search tasks by keyword', preconditions: 'Tasks exist', steps: '1. Type keyword in search box', expected: 'Table filters in real-time', actual: 'Filter works', status: 'Pass', priority: 'Medium', severity: 'Major', case_type: 'Positive' },
      { tcid: 'TC-TASK-004', title: 'All Status filter', preconditions: 'Tasks exist', steps: '1. Click All Status\n2. Pick "In Progress"', expected: 'Table shows only In Progress tasks', actual: 'Filter applied', status: 'Pass', priority: 'Medium', severity: 'Major', case_type: 'Positive' },
      { tcid: 'TC-TASK-005', title: 'All Priority filter', preconditions: 'Tasks exist', steps: '1. Click All Priority\n2. Pick "High"', expected: 'Table shows only High-priority tasks', actual: 'Filter applied', status: 'Pass', priority: 'Medium', severity: 'Major', case_type: 'Positive' },
      { tcid: 'TC-TASK-006', title: 'All Time filter', preconditions: 'Tasks exist', steps: '1. Click All Time\n2. Pick "Last 7 days"', expected: 'Table filters by date range', actual: 'Filter applied', status: 'Pass', priority: 'Medium', severity: 'Major', case_type: 'Positive' },
      { tcid: 'TC-TASK-007', title: 'Sort by Match (↓/↑)', preconditions: 'Tasks exist', steps: '1. Click Match header', expected: 'Sort order toggles asc/desc', actual: 'Sorting works', status: 'Pass', priority: 'Low', severity: 'Minor', case_type: 'Positive' },
      { tcid: 'TC-TASK-008', title: 'Sort by Due Date', preconditions: 'Tasks exist', steps: '1. Click Due Date header', expected: 'Sorted by date', actual: 'Sorting works', status: 'Pass', priority: 'Low', severity: 'Minor', case_type: 'Positive' },
      { tcid: 'TC-TASK-009', title: 'Sort by Effort', preconditions: 'Tasks exist', steps: '1. Click Effort header', expected: 'Sorted by effort value', actual: 'Sorting works', status: 'Pass', priority: 'Low', severity: 'Minor', case_type: 'Positive' },
      { tcid: 'TC-TASK-010', title: 'Click task row opens detail', preconditions: 'Tasks exist', steps: '1. Click any task row', expected: 'Task detail view opens', actual: 'Navigation works', status: 'Pass', priority: 'Medium', severity: 'Major', case_type: 'Positive' },
      { tcid: 'TC-TASK-011', title: 'Multiple filters combined', preconditions: 'Tasks exist', steps: '1. Apply Status + Priority + Time', expected: 'Results match all three filters', actual: 'Combined filter works', status: 'Pass', priority: 'Medium', severity: 'Major', case_type: 'Edge' },
      { tcid: 'TC-TASK-012', title: 'Clear filters', preconditions: 'Filters applied', steps: '1. Reset each dropdown to "All"', expected: 'All tasks display again', actual: 'Reset works', status: 'Pass', priority: 'Low', severity: 'Minor', case_type: 'Positive' },
    ],
  },
  {
    name: 'Non-Functional / Security',
    description:
      'Cross-cutting checks: responsiveness, accessibility, HTTPS, session timeout, XSS/SQLi prevention, performance, cross-browser, and post-logout back-button protection.',
    high_level: [
      'TS-NFR-01 Verify page responsiveness on mobile, tablet, desktop',
      'TS-NFR-02 Verify accessibility (keyboard nav, ARIA labels)',
      'TS-NFR-03 Verify HTTPS + security headers on all pages',
      'TS-NFR-04 Verify session timeout & auto-logout',
      'TS-NFR-05 Verify SQL / XSS injection prevention on input fields',
      'TS-NFR-06 Verify page-load performance (<3s)',
    ],
    cases: [
      { tcid: 'TC-NFR-001', title: 'Mobile responsiveness', preconditions: 'Test device/emulator', steps: '1. Open site on 375×812 viewport\n2. Check login, dashboard, onboarding', expected: 'No overflow, elements stack cleanly', actual: 'UI responsive', status: 'Pass', priority: 'High', severity: 'Major', case_type: 'Positive' },
      { tcid: 'TC-NFR-002', title: 'Tablet responsiveness', preconditions: 'Tablet viewport', steps: '1. Open site on iPad view', expected: 'Layout adapts correctly', actual: 'UI responsive', status: 'Pass', priority: 'Medium', severity: 'Major', case_type: 'Positive' },
      { tcid: 'TC-NFR-003', title: 'Keyboard accessibility', preconditions: 'On any page', steps: '1. Use Tab / Shift+Tab across form\n2. Use Enter to submit', expected: 'Focus order logical, all controls reachable', actual: 'Accessible', status: 'Pass', priority: 'Medium', severity: 'Major', case_type: 'Positive' },
      { tcid: 'TC-NFR-004', title: 'HTTPS enforcement', preconditions: 'Browser open', steps: '1. Visit http://test-gt.vercel.app', expected: 'Auto-redirects to HTTPS', actual: 'Redirect works', status: 'Pass', priority: 'High', severity: 'Critical', case_type: 'Edge' },
      { tcid: 'TC-NFR-005', title: 'Session timeout', preconditions: 'Logged in', steps: '1. Stay idle 30 min', expected: 'Auto-logout + redirect to login', actual: 'Timeout works', status: 'Pass', priority: 'High', severity: 'Major', case_type: 'Edge' },
      { tcid: 'TC-NFR-006', title: 'XSS injection attempt', preconditions: 'On any input', steps: '1. Enter <script>alert(1)</script>\n2. Submit', expected: 'Input sanitized, no script executes', actual: 'Protected', status: 'Pass', priority: 'Critical', severity: 'Critical', case_type: 'Edge' },
      { tcid: 'TC-NFR-007', title: 'SQL injection attempt', preconditions: 'On email input', steps: "1. Enter ' OR 1=1 --", expected: 'Input sanitized, login rejected', actual: 'Protected', status: 'Pass', priority: 'Critical', severity: 'Critical', case_type: 'Edge' },
      { tcid: 'TC-NFR-008', title: 'Page load performance', preconditions: 'Network throttled to Fast 3G', steps: '1. Load login page', expected: 'Loads within 3s', actual: 'Meets target', status: 'Not Run', priority: 'Medium', severity: 'Major', case_type: 'Positive' },
      { tcid: 'TC-NFR-009', title: 'Browser compatibility', preconditions: 'Multiple browsers', steps: '1. Test on Chrome, Edge, Firefox, Safari', expected: 'All flows work identically', actual: 'Cross-browser OK', status: 'Pass', priority: 'Medium', severity: 'Major', case_type: 'Positive' },
      { tcid: 'TC-NFR-010', title: 'Back button after logout', preconditions: 'Logged out', steps: '1. Click browser Back', expected: 'Should NOT restore protected page', actual: 'Properly protected', status: 'Pass', priority: 'High', severity: 'Major', case_type: 'Edge' },
    ],
  },
];

function buildDescription(scenario) {
  const bullets = scenario.high_level.map(h => `• ${h}`).join('\n');
  return `${scenario.description}\n\nHigh-level scenarios:\n${bullets}`;
}

function seedGlimmora(db, { log = console.log } = {}) {
  const owner = db.prepare('SELECT id, email FROM users WHERE email = ?').get(OWNER_EMAIL);
  if (!owner) {
    throw new Error(
      `Seed owner user "${OWNER_EMAIL}" not found. Start the server once so the default users are seeded, then re-run.`,
    );
  }
  const pm = db.prepare('SELECT id FROM users WHERE email = ?').get(PM_EMAIL);

  let project = db.prepare('SELECT * FROM projects WHERE name = ?').get(PROJECT_NAME);
  if (!project) {
    const projectId = uuidv4();
    db.prepare(
      'INSERT INTO projects (id, name, description, created_by) VALUES (?, ?, ?, ?)',
    ).run(projectId, PROJECT_NAME, PROJECT_DESCRIPTION, owner.id);
    project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    log(`Created project "${PROJECT_NAME}" (${project.id})`);
  } else {
    db.prepare(
      "UPDATE projects SET description = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(PROJECT_DESCRIPTION, project.id);
    log(`Using existing project "${PROJECT_NAME}" (${project.id})`);
  }

  const ensureMember = userId => {
    if (!userId) return;
    const existing = db
      .prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(project.id, userId);
    if (!existing) {
      db.prepare(
        'INSERT INTO project_members (id, project_id, user_id) VALUES (?, ?, ?)',
      ).run(uuidv4(), project.id, userId);
    }
  };
  ensureMember(owner.id);
  if (pm) ensureMember(pm.id);

  let scenariosCreated = 0;
  let scenariosUpdated = 0;
  let casesCreated = 0;
  let casesUpdated = 0;

  for (const s of SCENARIOS) {
    let scenario = db
      .prepare('SELECT * FROM test_scenarios WHERE project_id = ? AND name = ?')
      .get(project.id, s.name);

    const desc = buildDescription(s);

    if (!scenario) {
      const scenarioId = uuidv4();
      db.prepare(
        `INSERT INTO test_scenarios (id, project_id, name, description, created_by)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(scenarioId, project.id, s.name, desc, owner.id);
      scenario = db.prepare('SELECT * FROM test_scenarios WHERE id = ?').get(scenarioId);
      scenariosCreated++;
    } else {
      db.prepare(
        `UPDATE test_scenarios SET description = ?, updated_at = datetime('now') WHERE id = ?`,
      ).run(desc, scenario.id);
      scenariosUpdated++;
    }

    for (const c of s.cases) {
      const fullTitle = `${c.tcid} — ${c.title}`;
      const existing = db
        .prepare(
          'SELECT id FROM test_cases WHERE scenario_id = ? AND title = ?',
        )
        .get(scenario.id, fullTitle);

      if (!existing) {
        const id = uuidv4();
        const maxNum = db
          .prepare(
            'SELECT COALESCE(MAX(tc_number), 0) AS max_num FROM test_cases WHERE project_id = ?',
          )
          .get(project.id);
        const tcNumber = (maxNum?.max_num || 0) + 1;

        db.prepare(
          `INSERT INTO test_cases (
             id, tc_number, scenario_id, project_id, title, description, preconditions, steps,
             expected_result, actual_result, status, priority, severity, case_type, created_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          tcNumber,
          scenario.id,
          project.id,
          fullTitle,
          c.title,
          c.preconditions || '',
          c.steps || '',
          c.expected || '',
          c.actual || '',
          c.status || 'Not Run',
          c.priority || 'Medium',
          c.severity || 'Major',
          c.case_type || 'Positive',
          owner.id,
        );
        casesCreated++;
      } else {
        db.prepare(
          `UPDATE test_cases SET
             description = ?, preconditions = ?, steps = ?, expected_result = ?,
             actual_result = ?, status = ?, priority = ?, severity = ?, case_type = ?,
             updated_at = datetime('now')
           WHERE id = ?`,
        ).run(
          c.title,
          c.preconditions || '',
          c.steps || '',
          c.expected || '',
          c.actual || '',
          c.status || 'Not Run',
          c.priority || 'Medium',
          c.severity || 'Major',
          c.case_type || 'Positive',
          existing.id,
        );
        casesUpdated++;
      }
    }
  }

  log(`Glimmora seed — scenarios: ${scenariosCreated} created, ${scenariosUpdated} updated; cases: ${casesCreated} created, ${casesUpdated} updated`);

  return { scenariosCreated, scenariosUpdated, casesCreated, casesUpdated, projectId: project.id };
}

async function main() {
  await initializeDatabase();
  const db = getDb();
  seedGlimmora(db);
  console.log('\nDone. Open the Test Cases module → "Glimmora Team" to view.');
  // Give the snapshot timer a moment to flush to Postgres if DATABASE_URL is set.
  await new Promise(r => setTimeout(r, 4000));
  process.exit(0);
}

module.exports = { seedGlimmora };

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
