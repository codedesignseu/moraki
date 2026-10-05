# App Store listing copy

**Task:** P5-06. **Written:** 2026-10-05. **For:** App Store Connect, v1 (free, no in-app
purchases, no push notifications, no widgets, no analytics). The Play Store listing reuses the
same text: Play's short description is 80 characters, so use the promotional text's first
sentence there.

Every text below follows CLAUDE.md rule 10 and SDD 12.3: it says what the app records and adds
up, and never what a number means. No "normal", "healthy", "too little", "concerning", "your baby
should", and no claim that the app helps a baby do anything. Screenshots are the owner's, taken
on a device.

Character counts are Unicode characters, counted with `[...text].length`, including spaces and
line breaks. Apple's limits are in characters. Greek letters are two bytes each in UTF-8; if App
Store Connect ever rejects the Greek keywords as too long, it is counting bytes, and the list
needs trimming to 100 bytes.

---

## Fields that are the same in both languages

| Field              | Value                                                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary category   | Health & Fitness                                                                                                                                                       |
| Secondary category | Lifestyle                                                                                                                                                              |
| Price              | Free                                                                                                                                                                   |
| Support URL        | https://moraki.app/support (Greek: https://moraki.app/el/support/)                                                                                                     |
| Marketing URL      | https://moraki.app (Greek: https://moraki.app/el/). The landing page is `public/index.html` (P5-F4)                                                                    |
| Privacy policy URL | https://moraki.app/privacy (Greek: https://moraki.app/el/privacy/)                                                                                                     |
| Terms (EULA)       | Apple's standard EULA applies unless a custom one is entered. `https://moraki.app/terms` can go in the description's last line or as a custom EULA, the owner's choice |
| Copyright          | 2026 CE Code Designs Ltd                                                                                                                                               |
| Export compliance  | `ITSAppUsesNonExemptEncryption` is already `false` in `app.json` (HTTPS only)                                                                                          |
| Sign-in required   | No. The app works without an account; an account is needed to share with caregivers                                                                                    |
| Account deletion   | In the app, in Settings (P4-06), as guideline 5.1.1(v) requires                                                                                                        |

---

## English (U.K. or U.S.)

### Name

```text
Moraki: Newborn Tracker
```

23 characters (limit 30).

### Subtitle

```text
Shared feeds, diapers & sleep
```

29 characters (limit 30).

### Promotional text

```text
Log a bottle in two taps, one-handed, at 4am. Everyone caring for your baby sees the same feeds, diapers and sleep, on their own phone, even with no signal.
```

156 characters (limit 170).

### Description

```text
Moraki is a shared notebook for the people looking after a newborn. One of you logs a feed, and every phone in the household shows it, usually within seconds.

MADE FOR 4AM
• Log a bottle in two taps: the sheet opens with your last amount and the time already filled in
• See at a glance how long it has been since the last feed, and which side is next
• Night mode with a warm, dim palette and large text
• Works with no signal. Entries stay on the phone and sync when there is a connection

EVERYTHING IN ONE PLACE
• Bottle and breastfeeding, with sides and times
• Diapers, sleep and pumping
• Expressed milk stock, in the fridge and the freezer
• Weight, temperature, medication and notes
• Appointments, with the questions you want to ask

SHARED, NOT SCATTERED
• Invite a partner, a grandparent or a carer with a single-use code
• Everyone sees the same entries and who logged them
• Choose who logs and who only views

READY FOR THE PEDIATRICIAN
• A call script with the figures in the order a clinician usually asks for them
• Summaries for the last 24 hours, 3 days or 7 days, shareable as a PDF
• Weekly trends for feeds, diapers and sleep, and a weight view against birth weight

YOUR DATA STAYS YOURS
• Stored on your phone and on servers in the EU
• Only your household sees it. It is never sold, never used for advertising, and never used to train any model
• No ads and no analytics
• Export everything as CSV and JSON at any time
• Delete your account in the app

Moraki records what you log and adds it up. It is not a medical device and does not give medical advice. If you are worried about your baby, contact your doctor or your local emergency number.

Free, with no in-app purchases. In English and Greek.

Privacy: https://moraki.app/privacy
Terms: https://moraki.app/terms
```

1796 characters (limit 4000).

### Keywords

```text
baby,feeding,breastfeeding,bottle,nappy,pumping,breast milk,infant,log,parents,caregiver,weight
```

95 characters (limit 100). Words already in the name and subtitle (moraki,
newborn, tracker, shared, feeds, diapers, sleep) are left out, because Apple indexes those fields
already.

---

## Greek (Ελληνικά)

### Name

```text
Moraki: Ημερολόγιο μωρού
```

24 characters (limit 30).

### Subtitle

```text
Ταΐσματα, πάνες, ύπνος, μαζί
```

28 characters (limit 30).

### Promotional text

```text
Κατέγραψε ένα μπιμπερό με δύο αγγίγματα, με το ένα χέρι, στις 4 το πρωί. Όλοι όσοι φροντίζουν το μωρό βλέπουν τα ίδια ταΐσματα, πάνες και ύπνο, ακόμα και χωρίς σήμα.
```

165 characters (limit 170).

### Description

```text
Το Moraki είναι ένα κοινό τετράδιο για όσους φροντίζουν ένα νεογέννητο. Ένας από εσάς καταγράφει ένα τάισμα, και εμφανίζεται σε κάθε τηλέφωνο του νοικοκυριού, συνήθως μέσα σε δευτερόλεπτα.

ΦΤΙΑΓΜΕΝΟ ΓΙΑ ΤΙΣ 4 ΤΟ ΠΡΩΙ
• Κατέγραψε ένα μπιμπερό με δύο αγγίγματα: η φόρμα ανοίγει με την τελευταία ποσότητα και την ώρα ήδη συμπληρωμένες
• Δες με μια ματιά πόση ώρα πέρασε από το τελευταίο τάισμα και ποια πλευρά είναι η επόμενη
• Νυχτερινή λειτουργία με ζεστά, χαμηλά χρώματα και μεγάλα γράμματα
• Δουλεύει χωρίς σήμα. Οι εγγραφές μένουν στο τηλέφωνο και συγχρονίζονται όταν υπάρχει σύνδεση

ΟΛΑ ΣΕ ΕΝΑ ΣΗΜΕΙΟ
• Μπιμπερό και θηλασμός, με πλευρές και χρόνους
• Πάνες, ύπνος και αντλήσεις
• Απόθεμα γάλακτος, στο ψυγείο και στην κατάψυξη
• Βάρος, θερμοκρασία, φάρμακα και σημειώσεις
• Ραντεβού, μαζί με τις ερωτήσεις που θέλεις να κάνεις

ΚΟΙΝΟ, ΟΧΙ ΣΚΟΡΠΙΣΜΕΝΟ
• Προσκάλεσε σύντροφο, παππού, γιαγιά ή όποιον βοηθά, με κωδικό μίας χρήσης
• Όλοι βλέπουν τις ίδιες εγγραφές και ποιος τις έκανε
• Διάλεξε ποιος καταγράφει και ποιος μόνο βλέπει

ΕΤΟΙΜΟ ΓΙΑ ΤΟΝ ΠΑΙΔΙΑΤΡΟ
• Κείμενο για το τηλέφωνο, με τα νούμερα με τη σειρά που συνήθως τα ρωτά ο γιατρός
• Περιλήψεις για το τελευταίο 24ωρο, τις τελευταίες 3 ή 7 ημέρες, που μοιράζονται ως PDF
• Εβδομαδιαίες τάσεις για ταΐσματα, πάνες και ύπνο, και προβολή βάρους σε σχέση με το βάρος γέννησης

ΤΑ ΔΕΔΟΜΕΝΑ ΣΟΥ ΜΕΝΟΥΝ ΔΙΚΑ ΣΟΥ
• Αποθηκεύονται στο τηλέφωνό σου και σε διακομιστές στην ΕΕ
• Τα βλέπει μόνο το νοικοκυριό σου. Δεν πωλούνται ποτέ, δεν χρησιμοποιούνται για διαφημίσεις και δεν χρησιμοποιούνται για την εκπαίδευση κανενός μοντέλου
• Χωρίς διαφημίσεις και χωρίς analytics
• Εξαγωγή όλων σε CSV και JSON όποτε θέλεις
• Διαγραφή λογαριασμού μέσα από την εφαρμογή

Το Moraki καταγράφει ό,τι γράφεις και το αθροίζει. Δεν είναι ιατρική συσκευή και δεν δίνει ιατρικές συμβουλές. Αν κάτι σε προβληματίζει για το μωρό σου, μίλα με τον γιατρό σου ή κάλεσε το τοπικό τηλέφωνο επείγουσας ανάγκης.

Δωρεάν, χωρίς αγορές μέσα στην εφαρμογή. Στα ελληνικά και στα αγγλικά.

Απόρρητο: https://moraki.app/el/privacy/
Όροι: https://moraki.app/el/terms/
```

2083 characters (limit 4000).

### Keywords

```text
μωρό,νεογέννητο,θηλασμός,μπιμπερό,τάισμα,άντληση,γάλα,βρέφος,γονείς,βάρος,πάνα,φροντίδα
```

87 characters, 163 UTF-8 bytes (limit 100 characters).
Words in the Greek name and subtitle are left out.

---

## Age rating answers

Apple's questionnaire as of 2026. Every content question is answered at its lowest level, because
the app shows only what the household typed and has no public content.

| Question                                                                                | Answer  | Why                                                                                                                                        |
| --------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Parental controls                                                                       | No      | none in the app                                                                                                                            |
| Age assurance                                                                           | No      | none in the app; the terms say users are adults                                                                                            |
| Unrestricted web access                                                                 | No      | no in-app browser; links open the system browser                                                                                           |
| User-generated content                                                                  | No      | entries are seen only inside a household the owner invited people to. There is no public feed, profile, comment or discovery               |
| Messaging and chat                                                                      | No      | none                                                                                                                                       |
| Advertising                                                                             | No      | none                                                                                                                                       |
| Cartoon or fantasy violence; realistic violence; prolonged graphic or sadistic violence | None    |                                                                                                                                            |
| Profanity or crude humour                                                               | None    |                                                                                                                                            |
| Mature or suggestive themes                                                             | None    |                                                                                                                                            |
| Horror or fear themes                                                                   | None    |                                                                                                                                            |
| Sexual content or nudity; graphic sexual content and nudity                             | None    |                                                                                                                                            |
| Alcohol, tobacco or drug use or references                                              | None    | medication entries are a name and a dose typed by a parent, not references to drug use                                                     |
| Simulated gambling; contests; gambling                                                  | None/No |                                                                                                                                            |
| Medical or treatment information                                                        | None    | the app presents no medical information. It records and adds up what the parent typed, with no interpretation, ranges or advice (SDD 12.2) |
| Health or wellness topics                                                               | Yes     | it is a baby-care log that records feeds, weight, temperature and medication                                                               |
| Guns or other weapons                                                                   | None    |                                                                                                                                            |

Expected result: **4+**. Confirm the rating App Store Connect computes; the questions are reworded
from time to time.

---

## Review notes for Apple

Paste into App Review Information → Notes. English only; App Review reads English.

```text
Moraki is a newborn care log shared between the caregivers of one baby. It records and adds up what a parent types (feeds, diapers, sleep, pumping, weight, temperature, medication, notes, appointments). It does not interpret any figure, give medical advice or claim to be a medical device; the About screen in Settings says so.

SIGN IN
Sign-in is optional: the app works fully on the phone without an account. An account is needed to share a household with other caregivers. Sign-in is by a one-time code sent by email, Sign in with Apple, or Google.

DEMO ACCOUNT
The owner provides a demo account in the App Review "Sign-in required" fields. It is already in a household with a baby and several days of entries, so every screen has content.
[OWNER TO FILL IN: how the reviewer receives the email sign-in code for this account, or confirm the reviewer should use the account through another method. Do not paste credentials here; use the sign-in fields.]

HEALTH DATA CONSENT
After signing in, each caregiver is asked for explicit consent to process health data, on its own screen (GDPR Article 9). Choosing "Not now" leaves the app working on the phone; entries then do not sync. Consent can be withdrawn in Settings → Privacy → Health data.

ACCOUNT DELETION (guideline 5.1.1(v))
Settings lets a person leave a household, delete a household they own, or delete their account. Deleting the account removes it from our servers. In a household shared with others, the other caregivers keep the entries, and the departing owner chooses who becomes owner.

SHARING
To see sharing, use Settings → Invite a caregiver to make a single-use code, and join it from a second account with Settings → Join with a code.
[OWNER TO FILL IN: a second demo account, if you want the reviewer to try joining.]

OTHER
- No in-app purchases, no subscriptions, no ads, no analytics, no tracking.
- Feed reminders are local notifications scheduled on the device; their text contains no health figures. There are no push notifications.
- Data is stored on the device and in Supabase in Frankfurt (EU). Crash reports go to Sentry's EU region with personal data removed.
- Export: Settings → Your data → Export everything (CSV and JSON).

Support: https://moraki.app/support
Privacy: https://moraki.app/privacy
Contact: info@codedesigns.eu
```

2304 characters (Apple's limit is 4000).

### Demo account (owner fills in, in App Store Connect only)

| Field     | Value                                                         |
| --------- | ------------------------------------------------------------- |
| User name | **[OWNER TO FILL IN in App Store Connect, not in this file]** |
| Password  | **[OWNER TO FILL IN in App Store Connect, not in this file]** |

The app has no passwords: an email account signs in with a code. Apple's fields still need
something the reviewer can use. Decide how the reviewer receives the code before submitting (for
example a mailbox the reviewer can open, or a demo address set up so its code reaches you while
you are on hand to relay it), and say which in the notes above. Never commit the credentials.
