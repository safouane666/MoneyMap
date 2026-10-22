# Google Play Console — Penny full answer sheet

Open: [https://play.google.com/console](https://play.google.com/console) → your Penny app → use the **Dashboard** checklist top to bottom.

**Do not invent answers.** Every choice below is for Penny as shipped today:
package `app.penny.mobile`, free, no ads, no bank linking, email/Google login, manual expense tracking, local notifications.


| Fact                   | Value                                                                                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App name               | `Penny: AI Money Tracker`                                                                                                                                                                                        |
| Package                | `app.penny.mobile`                                                                                                                                                                                               |
| Version name           | `1.0.2`                                                                                                                                                                                                          |
| Version code           | `5` (R8 minify, edge-to-edge, 16 KB pages / Expo SDK 53)                                                                                                                                                          |
| Support email          | `pennyaitracker@gmail.com`                                                                                                                                                                                       |
| Website                | `https://penny.phronexus-ai.com`                                                                                                                                                                                 |
| Privacy                | `https://penny.phronexus-ai.com/privacy`                                                                                                                                                                         |
| Delete data            | `https://penny.phronexus-ai.com/delete-data`                                                                                                                                                                     |
| Terms                  | `https://penny.phronexus-ai.com/terms`                                                                                                                                                                           |
| AAB                    | [https://expo.dev/accounts/safouane666/projects/clear-money/builds/0a7b754c-775c-43e0-9426-9a32aa31f807](https://expo.dev/accounts/safouane666/projects/clear-money/builds/0a7b754c-775c-43e0-9426-9a32aa31f807) (API 36 / versionCode 4) |
| Demo login (reviewers) | `pennyaitracker@gmail.com` / `safsafsaf`                                                                                                                                                                         |


---

## A. Create the app (first time only)

**All apps → Create app**


| Field            | Paste / choose                                                |
| ---------------- | ------------------------------------------------------------- |
| App name         | `Penny: AI Money Tracker`                                     |
| Default language | English (United States)                                       |
| App or game      | **App**                                                       |
| Free or paid     | **Free**                                                      |
| Declarations     | Check **all** required boxes (Play policies + US export laws) |


→ **Create app**

---

## B. Dashboard task: Privacy policy

**Policy and programs → App content → Privacy policy → Start**


| Field              | Paste                                    |
| ------------------ | ---------------------------------------- |
| Privacy policy URL | `https://penny.phronexus-ai.com/privacy` |


→ **Save**

---

## C. Dashboard task: App access

**Policy and programs → App content → App access → Start**

1. Select: **All functionality is available without special access**
  *(Anyone can create an account. No paid wall for core features.)*
2. If Google still asks for credentials (common for login apps), switch to **All or some functionality is restricted** and add **one** instruction set:


| Field                   | Paste                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Name / Instruction name | `Demo account`                                                                                                      |
| Username / Email        | `pennyaitracker@gmail.com`                                                                                          |
| Password                | `safsafsaf`                                                                                                         |
| Any other info          | `Sign in with email/password (not Google). Opens a personal space with sample transactions for screenshots/review.` |


→ **Save**

---

## D. Dashboard task: Ads

**Policy and programs → App content → Ads → Start**


| Question                   | Answer |
| -------------------------- | ------ |
| Does your app contain ads? | **No** |


→ **Save**

---

## E. Dashboard task: Content ratings

**Policy and programs → App content → Content ratings → Start questionnaire**

### E1. Email + category


| Field             | Answer                                                                    |
| ----------------- | ------------------------------------------------------------------------- |
| Email address     | `pennyaitracker@gmail.com`                                                |
| Category          | **Utility, Productivity, Communication, or Other**                        |
| Sub-category feel | Productivity / Finance utility (pick closest Utility/Productivity option) |


### E2. Questionnaire — answer **No** to almost everything

Go through every screen. Use this map:


| Topic Google asks about                                    | Your answer                                |
| ---------------------------------------------------------- | ------------------------------------------ |
| Violence                                                   | **No**                                     |
| Sexual content                                             | **No**                                     |
| Profanity / crude humor                                    | **No**                                     |
| Controlled substances (alcohol, tobacco, drugs)            | **No**                                     |
| Weapons / military                                         | **No**                                     |
| Gambling / simulated gambling / cash prizes                | **No**                                     |
| Horror / fear                                              | **No**                                     |
| Location sharing                                           | **No**                                     |
| User-generated public content / social network             | **No** (ledgers are private / invite-only) |
| Users can communicate / chat publicly                      | **No**                                     |
| Shares user’s personal info with others without permission | **No**                                     |
| Misinformation / news publishing                           | **No**                                     |
| Age-restricted purchases                                   | **No**                                     |


If a question mentions **in-app purchases that unlock mature content** → **No**.

→ Submit → **Apply rating** (expect Everyone / PEGI 3 / equivalent).

---

## F. Dashboard task: Target audience and content

**Policy and programs → App content → Target audience and content → Start**


| Question                  | Answer                                            |
| ------------------------- | ------------------------------------------------- |
| Target age groups         | Check **18 and over** only (finance app — safest) |
| Appeals to children?      | **No**                                            |
| Store presence / Families | Do **not** enroll in Designed for Families        |
| Ads & children follow-ups | Skip / N/A because not for children               |


→ **Save**

---

## G. Dashboard task: News apps


| Question            | Answer |
| ------------------- | ------ |
| Is this a news app? | **No** |


→ **Save**

---

## H. Dashboard task: COVID-19 apps


| Question                          | Answer |
| --------------------------------- | ------ |
| COVID-19 contact tracing / status | **No** |


→ **Save**

---

## I. Dashboard task: Data safety (long form — fill every page)

**Policy and programs → App content → Data safety → Start**

### I1. Overview


| Question                                                              | Answer  |
| --------------------------------------------------------------------- | ------- |
| Does your app collect or share any of the required user data types?   | **Yes** |
| Is all of the user data collected by your app encrypted in transit?   | **Yes** |
| Do you provide a way for users to request that their data be deleted? | **Yes** |


Deletion method when asked:

```text
Users can request deletion at https://penny.phronexus-ai.com/delete-data (enter account email) or by emailing pennyaitracker@gmail.com. Privacy: https://penny.phronexus-ai.com/privacy
```

**Data deletion request URL (Play Console field):**

```text
https://penny.phronexus-ai.com/delete-data
```

### I2. Data types — check ONLY these

Tick these categories (leave everything else **unchecked**):

**Personal info**

- [x] **Name**
- [x] **Email address**
- [x] **User IDs**
- [ ] Phone, address, race, political, sexual orientation, etc. → leave off

**Financial info**

- [x] **Other financial info**  
  *(user-typed income/expense amounts, categories, goals — NOT bank account numbers, NOT credit cards)*
- [ ] User payment info → **off** (no card vaulting in v1)
- [ ] Credit score → **off**

**Photos and videos / Audio / Files → all off**  
**Calendar / Contacts / Messages → all off**  
**Location → all off**  
**Web browsing → all off**  
**App activity**

- [x] **App interactions** *(optional but honest if you keep basic product analytics later; if you truly log nothing, leave off)*  
  Recommended for Penny v1: **check App interactions** only if crash/usage logs exist; otherwise leave off. Current build: Sentry is a no-op → you may leave App interactions **off**.
- [ ] In-app search history → off unless you store Ask Penny queries server-side as identifiable history (if stored with account, check **Other in-app messages** or similar — safest: treat Ask Penny prompts as **App interactions** or **Other user-generated content** if Google shows that under UGC)

**App info and performance**

- [ ] Crash logs / Diagnostics → **off** for now (Sentry not live)
- [ ] Other app performance → **off**

**Device or other IDs**

- [ ] Device or other IDs → **off** (no Advertising ID; no analytics device id product)

### I3. For EACH checked data type, answer the same pattern

Repeat for **Name**, **Email address**, **User IDs**, **Other financial info** (and App interactions if checked):


| Sub-question                                                                    | Answer                                                                                                                              |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Is this data collected, shared, or both?                                        | **Collected**                                                                                                                       |
| Is this data processed ephemerally?                                             | **No** (stored so the account/ledger works)                                                                                         |
| Is this data required for your app, or can users choose whether it's collected? | **Data collection is required** (account + ledger can’t work without it) — for optional analytics only, choose **Users can choose** |
| Why is this user data collected?                                                | See table below                                                                                                                     |
| Is this data shared with third parties?                                         | **No**                                                                                                                              |


**Purposes to tick:**


| Data type                 | Purposes (tick these)                                                     |
| ------------------------- | ------------------------------------------------------------------------- |
| Name                      | **App functionality**, **Account management**                             |
| Email address             | **App functionality**, **Account management**                             |
| User IDs                  | **App functionality**, **Account management**                             |
| Other financial info      | **App functionality** only (not Advertising, not Fraud unless you add it) |
| App interactions (if any) | **Analytics**, **App functionality**                                      |


Do **not** tick: Advertising or marketing, Personalization for ads, Selling data.

### I4. Preview / submit

Review the store-facing summary → **Save**

**Optional free-text if shown:**

```text
Penny stores account and ledger data you create so the app can sync across devices. We do not sell personal data. Transaction history is user-entered and is not used for advertising. Deletion requests: pennyaitracker@gmail.com — https://penny.phronexus-ai.com/privacy
```

---

## J. Dashboard task: Advertising ID

**Policy and programs →** Advertising ID **→ Advertising ID** (or under Declared permissions / Advertising ID)


| Question                          | Answer |
| --------------------------------- | ------ |
| Does your app use advertising ID? | **No** |


*(Penny has no ads SDK and does not declare AD_ID.)*

→ **Save**

---

## K. Dashboard task: Government apps


| Question                  | Answer |
| ------------------------- | ------ |
| Is this a government app? | **No** |


→ **Save**

---

## L. Dashboard task: Financial features

**Policy and programs → App content → Financial features → Start**

Penny is a **manual money tracker**. It is **not** a bank, lender, wallet, crypto exchange, or licensed advisor.


| Choice                                                                          | Select?               |
| ------------------------------------------------------------------------------- | --------------------- |
| Personal loan / payday / banking / line of credit / wage advance / microfinance | **No**                |
| Mobile payments / digital wallets / money transfer                              | **No**                |
| Buy now pay later / rewards programs as payment                                 | **No**                |
| Crypto wallet / exchange / NFT / stock trading / crowdfunding                   | **No**                |
| Credit monitoring / insurance                                                   | **No**                |
| Financial advice (regulated advisory product)                                   | **No**                |
| **My app doesn’t provide any**App content                                       | **YES — select this** |


If the UI forces a follow-up “Other”, paste:

```text
Penny is a personal expense and budget tracker. Users manually log income and expenses. It does not connect to bank accounts, process payments, lend money, or provide licensed financial advice.
```

→ **Save**

---

## M. Dashboard task: Health / Health apps (if shown)


| Question                        | Answer |
| ------------------------------- | ------ |
| Is this a health / medical app? | **No** |


→ **Save**

---

## N. Dashboard task: Permissions / Sensitive permissions (if shown)

Penny uses: notifications, boot completed, exact alarm. **No** SMS, Call Log, Location, Camera, Contacts, Microphone.


| If asked about SMS / Call log                 | Answer |
| --------------------------------------------- | ------ |
| Does the app use SMS or Call Log permissions? | **No** |


Any “why do you need X” for notifications:

```text
Local reminders for daily logging, weekly summaries, and month-end nudges. Notifications are optional and controlled in device settings.
```

→ **Save**

---

## O. Store listing (Dashboard: “Set up your store”)

**Grow → Store presence → Main store listing**  
(Exact labels: **Main store listing**)

### O1. Text

**App name (≤30):**

```text
Penny: AI Money Tracker
```

**Short description (≤80):**

```text
Calm AI money tracker — safe-to-spend, spaces, goals, and smart reminders.
```

**Full description:**

```text
Penny is your AI money tracker — clear, calm, and built for real life.

See what you can safely spend, keep personal and shared spaces in sync, and get gentle reminders without the noise of a spreadsheet.

WHY PENNY
• Safe to spend on Home — net, income, expenses, then what’s left
• Personal and shared spaces — household bills with invite links
• Categories that fit — log fast, customize labels, see where money goes
• Salary & subscriptions — recurring items stay on the map
• Ask Penny — AI coaching on your ledger, not generic tips
• Smart reminders — daily log nudge, weekly wrap-ups, month-end alerts
• English, French, and Arabic

BUILT FOR
• Solo budgets with quiet clarity
• Household bills without shared confusion
• Shared trips or roommates with clear roles

PRIVACY FIRST
Your ledger stays yours. We don’t sell your transaction history for ads.

Get started free on web or Android. Questions? Email pennyaitracker@gmail.com

Website: https://penny.phronexus-ai.com
Privacy: https://penny.phronexus-ai.com/privacy
Terms: https://penny.phronexus-ai.com/terms
```

### O2. Graphics


| Asset                   | Requirement            | What to upload                                                       |
| ----------------------- | ---------------------- | -------------------------------------------------------------------- |
| App icon                | 512×512 PNG            | Export from `apps/mobile/assets/icon.png`                            |
| Feature graphic         | **1024×500** PNG/JPEG  | Brand green `#1EC569` + Penny logo + text `Penny — AI Money Tracker` |
| Phone screenshots       | Min **2**, aim **4–8** | Home, Activity, Spaces, Goals, Ask Penny, Settings                   |
| 7-inch / 10-inch tablet | Optional for v1        | Skip                                                                 |
| Video                   | Optional               | Skip                                                                 |


### O3. Categorization


| Field        | Answer                                                                |
| ------------ | --------------------------------------------------------------------- |
| App category | **Finance**                                                           |
| Tags         | `budget`, `expense tracker`, `money`, `finance` (pick available tags) |


### O4. Contact details (on listing)


| Field   | Paste                            |
| ------- | -------------------------------- |
| Email   | `pennyaitracker@gmail.com`       |
| Phone   | leave empty                      |
| Website | `https://penny.phronexus-ai.com` |


→ **Save**

---

## P. Store settings (left nav: Store settings / App information)


| Field                                      | Paste                                    |
| ------------------------------------------ | ---------------------------------------- |
| App name                                   | `Penny: AI Money Tracker`                |
| Contact email                              | `pennyaitracker@gmail.com`               |
| External marketing / store listing contact | same email                               |
| Privacy policy                             | `https://penny.phronexus-ai.com/privacy` |


---

## Q. Countries / Pricing & distribution

**Monetize → Products → App pricing** (or **Pricing and distribution**)


| Field                                         | Answer                                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------------------- |
| Price                                         | **Free**                                                                               |
| Countries                                     | **Available in all countries** (or start with US + Morocco + EU if you prefer smaller) |
| Ads                                           | Already declared No                                                                    |
| Device categories                             | Phones (tablets optional)                                                              |
| Content guidelines / US export / news / COVID | Acknowledge required checkboxes                                                        |


→ **Save**

---

## R. App signing

When first uploading AAB:


| Question                | Answer                              |
| ----------------------- | ----------------------------------- |
| Google Play App Signing | **Accept / Continue** (recommended) |


Keep your EAS credentials backup. Do not opt out unless you know why.

---

## S. Upload binary + release notes

1. Download AAB (versionCode **5**, `1.0.2`, target API **36**, Expo SDK 53):
  [https://expo.dev/accounts/safouane666/projects/clear-money/builds/0a7b754c-775c-43e0-9426-9a32aa31f807](https://expo.dev/accounts/safouane666/projects/clear-money/builds/0a7b754c-775c-43e0-9426-9a32aa31f807)  
  Direct: [https://expo.dev/artifacts/eas/erBEgx57RVJkSeGuH4iepQCoH3wt-MbhNIV7-Nk1KBw.aab](https://expo.dev/artifacts/eas/erBEgx57RVJkSeGuH4iepQCoH3wt-MbhNIV7-Nk1KBw.aab)
2. Prefer first release path: **Test and release → Testing → Closed testing**
  (create a track, add yourself as tester, then later promote to Production)
3. **Create new release** → upload `.aab`

**Release name:**

```text
1.0.2 (5) — R8 obfuscation, edge-to-edge, 16 KB pages (Expo SDK 53)
```

**Release notes — en-US:**

```text
First public release of Penny — AI Money Tracker.
• Safe-to-spend on Home
• Personal and shared spaces
• Categories, goals, salary & subscriptions
• Ask Penny AI companion
• Smart reminders
• English, French, Arabic
```

→ **Next** → **Save** → **Send X to X for review** / **Start rollout to Production** when ready.

---

## T. Final “Send for review” checklist

Before you click submit, every Dashboard item should be green:

- [ ] Privacy policy URL opens in incognito
- [ ] App access filled (demo account if restricted)
- [ ] Ads = No
- [ ] Content rating applied
- [ ] Target audience = 18+
- [ ] News = No
- [ ] COVID = No
- [ ] Data safety saved
- [ ] Advertising ID = No
- [ ] Government = No
- [ ] Financial features = **doesn’t provide any**
- [ ] Store listing: name + short + full + icon + feature graphic + ≥2 screenshots
- [ ] Contact email works
- [ ] AAB uploaded with release notes
- [ ] Demo login works: `pennyaitracker@gmail.com` / `safsafsaf`

---

## U. After approval

Public URL will be:

```text
https://play.google.com/store/apps/details?id=app.penny.mobile
```

Add it to the website CTA when ready.

---

## Play Console quality warnings (versionCode 5+)

These are addressed in `apps/mobile` for the next AAB (`1.0.2` / code **5**):

| Console warning | Fix in repo |
| --- | --- |
| DEX obfuscation &lt; 25% | `expo-build-properties` → `enableMinifyInReleaseBuilds` + `enableShrinkResourcesInReleaseBuilds` + ProGuard keep rules |
| Edge-to-edge / deprecated window APIs | `android.edgeToEdgeEnabled` + `react-native-edge-to-edge` + `SystemBars` in root layout |
| Orientation / resizability (large screens) | `orientation: "default"` (no portrait lock) |
| 16 KB native page size | Expo **SDK 53** / RN **0.79.6** (`useLegacyPackaging: false`) |

Rebuild and upload:

```bash
cd apps/mobile
eas build -p android --profile production
```

Then upload the new AAB in Play Console → Production (or testing track) and confirm Bundle Explorer shows 16 KB compatible.

---

## Quick copy block (keep open while filling)

```text
App name: Penny: AI Money Tracker
Package: app.penny.mobile
Email: pennyaitracker@gmail.com
Website: https://penny.phronexus-ai.com
Privacy: https://penny.phronexus-ai.com/privacy
Terms: https://penny.phronexus-ai.com/terms
Demo: pennyaitracker@gmail.com / safsafsaf
Ads: No
Kids: No (18+)
News: No
COVID: No
Government: No
Advertising ID: No
Financial features: My app doesn’t provide any financial features
Category: Finance
Price: Free
```

