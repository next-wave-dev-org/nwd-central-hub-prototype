# nextwavedev.org: DNS, Email, and Domain Cleanup

Date: July 2026

## Summary

Inherited a Cloudflare account for nextwavedev.org with a messy DNS setup. Root cause: Cloudflare Email Routing had been set up early on, then Google Workspace was added later for real email, but the old Cloudflare Email Routing config was never removed. This left two mail systems fighting over the same MX records. Separately, portal.nextwavedev.org needed to move to a new Vercel project, and new-user signup confirmation emails weren't sending at all.

---

## 1. Email routing conflict (Cloudflare vs Google Workspace)

**Problem:** Cloudflare's DNS panel showed:
- Google Workspace MX records (aspmx.l.google.com, alt1-4.aspmx.l.google.com) marked "Conflicting"
- Cloudflare's own MX records (route1/2/3.mx.cloudflare.net) marked "Missing"
- A locked DKIM TXT record (cf2024-1._domainkey) tied to Cloudflare Email Routing
- An SPF record that only authorized Cloudflare's mail servers, not Google's

**Cause:** Cloudflare Email Routing was enabled on the domain before Google Workspace was added. Under Email Routing > Routing rules, there was one active forward: `taylor@nextwavedev.org` -> `taylorpapke.student@gmail.com`. It was dormant (not actually receiving mail) because Google's MX records, not Cloudflare's, were the ones actually live.

**Fix:**
1. Disabled Cloudflare Email Routing entirely (Email Routing > nextwavedev.org > Disable).
    - This automatically removed the "Missing" MX rows and cleared the "Conflicting" flag on Google's MX records.
2. Manually edited the SPF TXT record from:
   ```
   v=spf1 include:_spf.mx.cloudflare.net include:_spf.google.com ~all
   ```
   to:
   ```
   v=spf1 include:_spf.google.com ~all
   ```

**Still outstanding (cleanup, not urgent):**
- Delete the leftover `cf2024-1._domainkey` TXT record. It didn't auto-remove when Email Routing was disabled and no longer does anything.
- Delete the old `_vercel` TXT verification record for portal.nextwavedev.org with code `cf96f2bf3a488d2f74f4` (superseded, see section 2). Only delete once the new Vercel project is confirmed fully "Valid."
- Confirm whether the old `taylor@` -> Gmail forward is still needed by anyone. If so, it needs to be recreated as an alias inside Google Workspace admin, since Cloudflare Email Routing no longer exists.

---

## 2. Moving portal.nextwavedev.org to a new Vercel project

**Steps taken:**
1. Removed portal.nextwavedev.org from the old Vercel project (Settings > Domains).
2. Added portal.nextwavedev.org to the new Vercel project's domain settings.
3. Vercel flagged "Verification Required" (domain linked to another Vercel account) and asked for a TXT record:
   ```
   Type: TXT
   Name: _vercel
   Value: vc-domain-verify=portal.nextwavedev.org,ac11c683456ee414276a
   ```
4. Added that TXT record in Cloudflare (existing older `_vercel` TXT records for app and portal were left alone rather than overwritten).
5. No CNAME change was required. The existing CNAME (`70f1780a54c3fc0b.vercel-dns-017.com`, DNS only / grey cloud) already pointed at Vercel's edge and continued to work once ownership was verified.

**Note for next time:** disabling/removing a domain from an old project takes it offline until the new project is verified and pointing correctly. Worth having the new project's domain settings ready before removing it from the old one, to minimize downtime.

---

## 3. Signup confirmation emails not sending

**Problem:** New user signups said an email was sent, but nothing arrived.

**Investigation:**
- `send.nextwavedev.org` MX/SPF and the `resend._domainkey` TXT record already existed in DNS. These aren't two separate services, Resend uses Amazon SES on the backend for delivery, so all three records together are just Resend's domain verification.
- Checked Supabase Authentication settings: Custom SMTP was **not configured**. Supabase was using its own built-in email sender, which is rate-limited (roughly 100/day-ish on the free tier equivalent) and not meant for production use. This explains the missing emails.
- Got access to the existing Resend account (previously set up by someone before joining). Confirmed:
    - Domain (nextwavedev.org / send.nextwavedev.org): Verified
    - Emails/Logs tab: empty, zero sends in the last 30 days, confirming the Supabase <-> Resend connection had never actually been made
    - Free tier plan
    - Admin access now held on the account

**Fix (Supabase Custom SMTP):**
```
Host: smtp.resend.com
Username: resend
Password: [Resend API key]
Sender: noreply@send.nextwavedev.org
```
Set under Authentication > Settings > SMTP Settings in Supabase.

Verified working: test signup landed in Resend's Emails tab as Delivered.

---

## 4. Production redirect links

**Problem:** the confirmation link in the test email pointed to `localhost`.

**Fix:** In Supabase, under Authentication > URL Configuration:
- Updated **Site URL** to the production domain (e.g. `https://portal.nextwavedev.org`) instead of localhost.
- Added the production domain to the **Redirect URLs** allow-list (localhost was already in there, which is why local testing worked; production needed to be added separately or Supabase silently falls back to the Site URL default).

Confirmed done.

---

## Current state (as of this doc)

- Google Workspace is the sole email provider for nextwavedev.org. SPF is correct.
- Cloudflare Email Routing is fully disabled.
- portal.nextwavedev.org points to the new Vercel project.
- Resend is properly wired into Supabase as custom SMTP for auth emails, using the `send.` subdomain.
- Production redirect URLs are set correctly in Supabase.

