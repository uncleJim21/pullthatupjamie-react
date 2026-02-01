# Jamie Authentication & Subscription Test Plan

## Overview
Comprehensive manual testing checklist organized by authentication provider. Complete all tests for one provider before moving to the next.

---

## 0. Anonymous Usage & Upgrade Pathway

### 0.1 Anonymous → Sign Up Flow
- [ ] Open fresh browser / incognito window
- [ ] Navigate to `/app`
- [ ] Perform a search (no sign-in)
- [ ] **Check**: Search works for anonymous user
- [ ] Perform searches until quota exceeded
- [ ] **Check**: QuotaExceededModal appears
- [ ] **Check**: Shows "Continue with a free account" CTA
- [ ] Click CTA → SignInModal opens
- [ ] Complete sign up
- [ ] **Check**: SignUpSuccessModal appears with checkmark
- [ ] **Check**: Shows upgrade prompt for Jamie Plus
- [ ] **Check**: "Upgrade to Jamie Plus" button present
- [ ] **Check**: "Continue with free account" skip option present

### 0.2 Sign Up Success → Upgrade Path
- [ ] After sign up, on SignUpSuccessModal
- [ ] Click "Upgrade to Jamie Plus"
- [ ] **Check**: CheckoutModal opens with Jamie Plus selected
- [ ] Close checkout
- [ ] Sign out, sign up with new account
- [ ] Click "Continue with free account" (skip)
- [ ] **Check**: Modal closes, user continues as free registered user

### 0.3 Anonymous Entitlement Boundaries
- [ ] Fresh incognito session
- [ ] **search-quotes**: Perform searches until limit hit
- [ ] **Check**: Count matches expected anonymous limit (e.g., 3)
- [ ] **Check**: QuotaExceededModal appears on limit+1 attempt
- [ ] **search-quotes-3d**: Use 3D search until limit hit
- [ ] **Check**: Modal appears with sign-up prompt

---

## 1. Email Authentication

### 1.1 Sign Up (New User)
- [ ] Navigate to `/app`
- [ ] Click Account → Sign In
- [ ] Select Email provider
- [ ] Toggle to "Sign Up" mode
- [ ] Enter new email + password + confirm password
- [ ] Submit and verify success
- [ ] **Check**: SignUpSuccessModal appears with checkmark
- [ ] **Check**: Shows Jamie Plus upgrade prompt
- [ ] Click "Continue with free account"
- [ ] **Check**: `localStorage` has `auth_token`, `squareId` (email)
- [ ] **Check**: `subscriptionType` should be null or absent
- [ ] **Check**: "Upgrade" button visible in Account dropdown

### 1.2 Sign In (Free User)
- [ ] Sign out first
- [ ] Sign in with existing free account
- [ ] **Check**: Subscription status updates immediately (no stale state)
- [ ] Click Upgrade → Should show **Jamie Plus** option
- [ ] **Check**: Can toggle between Plus/Pro in checkout

### 1.3 Sign In (Plus User)
- [ ] Sign in with amber/Plus subscription account
- [ ] **Check**: `subscriptionType` = `amber` or `jamie-plus` in localStorage
- [ ] **Check**: "Upgrade" button IS visible
- [ ] Click Upgrade → Should show **Jamie Pro** selected
- [ ] **Check**: Plus option is disabled/hidden

### 1.4 Sign In (Pro User)
- [ ] Sign in with admin/Pro subscription account
- [ ] **Check**: `subscriptionType` = `admin` or `jamie-pro` in localStorage
- [ ] **Check**: "Upgrade" button NOT visible
- [ ] **Check**: "Pro Dashboard" navigates to feed page

### 1.5 Entitlement Boundaries (Email - Free)
- [ ] Sign in as free email user
- [ ] **search-quotes**: Use until limit hit (e.g., 3/day)
- [ ] **Check**: QuotaExceededModal shows "Keep exploring with Jamie Plus"
- [ ] **make-clip**: Create clips until limit hit
- [ ] **Check**: Modal appears with upgrade CTA
- [ ] **jamie-assist**: Use AI assist until limit hit
- [ ] **Check**: Modal appears with upgrade CTA
- [ ] **ai-analyze**: Use analysis until limit hit
- [ ] **Check**: Modal appears with upgrade CTA

### 1.6 Entitlement Boundaries (Email - Plus)
- [ ] Sign in as Plus email user
- [ ] **Check**: Higher limits than free tier
- [ ] Use features until Plus limits hit
- [ ] **Check**: QuotaExceededModal shows "Go unlimited with Jamie Pro"

### 1.7 Upgrade Flow (Email - Free → Plus)
- [ ] Sign in as free email user
- [ ] Click Upgrade from Account dropdown
- [ ] **Check**: Checkout shows "Jamie Plus" selected
- [ ] Complete checkout (test mode if available)
- [ ] **Check**: Success popup appears
- [ ] **Check**: `subscriptionType` updated in localStorage

### 1.8 Upgrade Flow (Email - Plus → Pro)
- [ ] Sign in as Plus email user
- [ ] Click Upgrade from Account dropdown
- [ ] **Check**: Checkout shows "Jamie Pro" selected
- [ ] **Check**: Plus option is disabled
- [ ] Complete checkout
- [ ] **Check**: Success popup shows Pro message

### 1.9 Cross-Page Tests (Email)
- [ ] Sign in on Landing Page (`/`) via Account button
- [ ] **Check**: Subscription status correct immediately
- [ ] Navigate to `/for-podcasters`
- [ ] **Check**: Auth state persists
- [ ] Click Upgrade → Correct product shown
- [ ] Navigate to `/app`
- [ ] **Check**: Auth state persists

### 1.10 localStorage Verification (Email)

| Key | Expected Value |
|-----|----------------|
| auth_token | JWT string |
| squareId | user@email.com |
| authProvider | (not set) |
| subscriptionType | null, amber, or admin |

---

## 2. Nostr Authentication

### 2.1 Prerequisites
- [ ] NIP-07 extension installed (nos2x, Alby, Flamingo, etc.)
- [ ] Extension has at least one key configured

### 2.2 Sign In (New Nostr User)
- [ ] Navigate to `/app`
- [ ] Click Account → Sign In
- [ ] Select Nostr provider
- [ ] Approve extension popup for public key
- [ ] Approve extension popup for signature
- [ ] **Check**: Success message, modal closes
- [ ] **Check**: `localStorage` has `auth_token`, `squareId` (npub format)
- [ ] **Check**: `authProvider` = `nostr`
- [ ] **Check**: Account button shows truncated npub (npub1...xyz)

### 2.3 Sign In (Existing Free Nostr User)
- [ ] Sign out first
- [ ] Sign in with Nostr
- [ ] **Check**: Subscription status updates immediately
- [ ] Click Upgrade → Should show **Jamie Plus** option

### 2.4 Sign In (Nostr Plus User)
- [ ] Sign in with Nostr account that has Plus
- [ ] **Check**: `subscriptionType` populated correctly from backend
- [ ] **Check**: "Upgrade" button IS visible
- [ ] Click Upgrade → Should show **Jamie Pro** selected

### 2.5 Sign In (Nostr Pro User)
- [ ] Sign in with Nostr account that has Pro
- [ ] **Check**: No "Upgrade" button visible
- [ ] **Check**: Pro Dashboard accessible

### 2.6 Entitlement Boundaries (Nostr - Free)
- [ ] Sign in as free Nostr user
- [ ] **search-quotes**: Use until limit hit
- [ ] **Check**: QuotaExceededModal appears with upgrade CTA
- [ ] **ai-analyze**: Use analysis until limit hit
- [ ] **Check**: Modal appears with "Keep exploring with Jamie Plus"

### 2.7 Upgrade Flow (Nostr - Free → Plus)
- [ ] Sign in as free Nostr user
- [ ] Click Upgrade from Account dropdown
- [ ] **Check**: Checkout shows "Jamie Plus" selected
- [ ] Complete checkout
- [ ] **Check**: Success popup appears
- [ ] **Check**: `subscriptionType` updated

### 2.8 Upgrade Flow (Nostr - Plus → Pro)
- [ ] Sign in as Plus Nostr user
- [ ] Click Upgrade
- [ ] **Check**: Checkout shows "Jamie Pro" selected
- [ ] **Check**: Plus option disabled
- [ ] Complete checkout
- [ ] **Check**: Success popup shows Pro message

### 2.9 Cross-Page Tests (Nostr)
- [ ] Sign in on `/app` with Nostr
- [ ] Navigate to Landing Page (`/`)
- [ ] **Check**: Auth state persists, npub displayed
- [ ] Navigate to `/for-podcasters`
- [ ] Click Upgrade → Correct product shown

### 2.10 localStorage Verification (Nostr)

| Key | Expected Value |
|-----|----------------|
| auth_token | JWT string |
| squareId | npub1... (bech32 format) |
| authProvider | nostr |
| subscriptionType | null, amber, or admin |

---

## 3. Twitter/X Authentication

### 3.1 Sign In (New Twitter User)
- [ ] Navigate to `/app`
- [ ] Click Account → Sign In
- [ ] Select Twitter/X provider
- [ ] Complete Twitter OAuth flow in popup/redirect
- [ ] **Check**: Redirected to `/auth/twitter/complete`
- [ ] **Check**: Success screen shows briefly
- [ ] **Check**: Redirects to `/app`
- [ ] **Check**: `localStorage` has `auth_token`, `squareId` (@username)
- [ ] **Check**: `authProvider` = `twitter`
- [ ] **Check**: Account button shows @username

### 3.2 Sign In (Existing Free Twitter User)
- [ ] Sign out first
- [ ] Sign in with Twitter
- [ ] **Check**: Subscription status updates immediately
- [ ] Click Upgrade → Should show **Jamie Plus** option

### 3.3 Sign In (Twitter Plus User)
- [ ] Sign in with Twitter account that has Plus
- [ ] **Check**: `subscriptionType` populated correctly
- [ ] **Check**: "Upgrade" button IS visible
- [ ] Click Upgrade → Should show **Jamie Pro** selected

### 3.4 Sign In (Twitter Pro User)
- [ ] Sign in with Twitter account that has Pro
- [ ] **Check**: No "Upgrade" button visible
- [ ] **Check**: Pro Dashboard accessible

### 3.5 Entitlement Boundaries (Twitter - Free)
- [ ] Sign in as free Twitter user
- [ ] **search-quotes**: Use until limit hit
- [ ] **Check**: QuotaExceededModal appears
- [ ] **make-clip**: Create clips until limit hit
- [ ] **Check**: Modal appears with upgrade CTA

### 3.6 Upgrade Flow (Twitter - Free → Plus)
- [ ] Sign in as free Twitter user
- [ ] Click Upgrade from Account dropdown
- [ ] **Check**: Checkout shows "Jamie Plus" selected
- [ ] Complete checkout
- [ ] **Check**: Success popup appears
- [ ] **Check**: `subscriptionType` updated

### 3.7 Upgrade Flow (Twitter - Plus → Pro)
- [ ] Sign in as Plus Twitter user
- [ ] Click Upgrade
- [ ] **Check**: Checkout shows "Jamie Pro" selected
- [ ] **Check**: Plus option disabled
- [ ] Complete checkout
- [ ] **Check**: Success popup shows Pro message

### 3.8 Cross-Page Tests (Twitter)
- [ ] Sign in on `/app` with Twitter
- [ ] Navigate to Landing Page (`/`)
- [ ] **Check**: Auth state persists, @username displayed
- [ ] Navigate to `/for-podcasters`
- [ ] Click Upgrade → Correct product shown

### 3.9 localStorage Verification (Twitter)

| Key | Expected Value |
|-----|----------------|
| auth_token | JWT string |
| squareId | @username |
| authProvider | twitter |
| subscriptionType | null, amber, or admin |

---

## 4. Admin/Pro Protected Features

### 4.1 Pro Dashboard Access Control
- [ ] Sign in as **Free** user (any provider)
- [ ] Navigate to Pro Dashboard (via Account dropdown or direct URL `/app/feed/{feedId}`)
- [ ] **Check**: Modal appears: "Pro Dashboard Access Required"
- [ ] **Check**: Upgrade CTA button present
- [ ] Sign out, sign in as **Plus** user
- [ ] Navigate to Pro Dashboard
- [ ] **Check**: Modal appears: "Pro Dashboard Access Required"
- [ ] Sign out, sign in as **Pro** user
- [ ] Navigate to Pro Dashboard
- [ ] **Check**: Dashboard loads successfully with feed data
- [ ] **Check**: No access denied modal

### 4.2 Admin Privileges API Check
- [ ] Sign in as **Free** user
- [ ] Open browser console, check `localStorage.getItem('admin_privs')`
- [ ] **Check**: Should be `null` or not present
- [ ] Sign in as **Pro** user
- [ ] **Check**: `localStorage.getItem('admin_privs')` = `'true'`

### 4.3 Feed Management (Pro Only)
- [ ] Sign in as **Pro** user with assigned feed
- [ ] Navigate to Pro Dashboard
- [ ] **Check**: Feed episodes list loads
- [ ] **Check**: Can access episode details
- [ ] **Check**: Can trigger clip generation (if enabled)
- [ ] Sign out, sign in as **Free** user
- [ ] Attempt to access same feed URL directly
- [ ] **Check**: Access denied / upgrade prompt shown

### 4.4 Clip Batch Access (Pro Only)  
- [ ] Sign in as **Pro** user
- [ ] Navigate to `/app/clipBatch/{runId}/{feedId}` (valid IDs)
- [ ] **Check**: Clip batch page loads with content
- [ ] Sign out, sign in as **Free** user
- [ ] Navigate to same clip batch URL
- [ ] **Check**: Access denied or upgrade prompt

### 4.5 On-Demand Run Submission (Pro Tier Limits)
- [ ] Sign in as **Free** user
- [ ] Go to TryJamie wizard, attempt to submit on-demand run
- [ ] **Check**: Quota limit applies (e.g., 3/day)
- [ ] Sign in as **Pro** user
- [ ] Submit multiple on-demand runs
- [ ] **Check**: No quota limit (unlimited)

---

## 5. Edge Cases (All Providers)

### 5.1 Rapid Sign In/Out
- [ ] Sign in, immediately sign out, immediately sign in again
- [ ] **Check**: No stale state, correct subscription shown

### 5.2 Tab Switching
- [ ] Sign in on one tab
- [ ] Open new tab to same page
- [ ] **Check**: Both tabs show correct auth state

### 5.3 Network Errors
- [ ] Attempt sign in with network disabled
- [ ] **Check**: Appropriate error message shown
- [ ] Re-enable network, retry
- [ ] **Check**: Sign in succeeds

### 5.4 Modal Z-Index Hierarchy
- [ ] Trigger QuotaExceededModal
- [ ] Click upgrade CTA
- [ ] **Check**: CheckoutModal appears ABOVE QuotaExceededModal
- [ ] Close CheckoutModal
- [ ] **Check**: QuotaExceededModal still visible behind

---

## 6. Entitlement Types Reference

| Entitlement | Anonymous | Free | Plus | Pro |
|-------------|-----------|------|------|-----|
| search-quotes | 3/day | 3/day | 30/day | Unlimited |
| search-quotes-3d | 3/day | 3/day | 30/day | Unlimited |
| make-clip | 0 | 3/day | 30/day | Unlimited |
| jamie-assist | 0 | 3/day | 30/day | Unlimited |
| ai-analyze | 0 | 3/day | 30/day | Unlimited |
| submit-on-demand-run | 0 | 3/day | 10/day | Unlimited |

*Note: Actual limits may differ - verify against backend config*

---

## 7. Known Issues to Watch

- [ ] Backend may return different subscription type values (amber vs jamie-plus, admin vs jamie-pro)
- [ ] JWT payload may not include subscriptionType - frontend falls back to localStorage
- [ ] Twitter OAuth requires redirect, may lose state on mobile browsers
- [ ] Nostr extension popups may be blocked by browser
- [ ] Nostr sign-in shows success confirmation with npub (no separate sign-up flow)

---

## Test Completion Sign-Off

| Section | Tester | Date | Pass/Fail |
|---------|--------|------|-----------|
| 0. Anonymous | | | |
| 1. Email | | | |
| 2. Nostr | | | |
| 3. Twitter | | | |
| 4. Admin/Pro | | | |
| 5. Edge Cases | | | |
