# Moraki: developer technical, functional and privacy assessment (questionnaire)

The owner's questionnaire, kept as received (2026-10-24). The answers are in `../developer-assessment-2026-10-24.md`.

- **Project:** Moraki (moraki.app)
- **Prepared for:** Code Designs Ltd
- **Purpose:** Technical fact-finding for legal documents and GDPR compliance
- **Scope:** iOS production/TestFlight, backend, website, and planned Android differences

## Instructions for the developer

Please review the app's actual source code, Supabase configuration, website, SDKs, data flows and current release build before answering.

For each question:

- Provide a clear answer, not simply "GDPR compliant".
- Mark the feature as **Implemented / Planned / Not Applicable / Unknown**.
- If the feature is implemented, explain how it works.
- Highlight differences between offline/local mode and signed-in/cloud mode.
- Identify any differences between iOS and planned Android functionality.
- Reference relevant code files, migrations, configuration settings or screenshots where useful.
- Flag any behaviour that differs from what the public website currently claims.

Do not implement changes based on these questions without discussing them first. The goal is to establish an accurate account of the existing product.

## SECTION A — App Architecture & Infrastructure (Privacy Policy, Terms of Use, Cookie Policy)

### A1. Application architecture

1. What frameworks, libraries and versions are used in Moraki? Confirm React Native, Expo SDK, SQLite library, Supabase SDK and other significant dependencies.
2. What version/build of Moraki is currently submitted to Apple? Is it identical to the latest development version?
3. Does the app run completely offline without creating an account?
4. Which functions work offline, and which require an internet connection or account?
5. Can users manually disable cloud synchronisation after signing in?
6. Does simply opening the app trigger any external network requests? Identify the services, endpoints and categories of data sent.
7. Does the app transmit any information to external services before a user creates an account or accepts the privacy/consent screen?
8. Is there any functionality that automatically uploads locally created baby records after an account is created? If yes, what action or permission triggers the upload?
9. Can the app connect to more than one backend environment, such as development, staging and production? Are these environments separated, with no real health data in testing?

### A2. Storage & infrastructure

10. Where is data stored locally? Confirm the SQLite implementation and database location.
11. Is the SQLite database encrypted at rest? If yes, what encryption technology is used, and how are encryption keys stored and protected?
12. Does the local database use iOS Data Protection or equivalent operating-system security?
13. Can app data be included in iCloud/iTunes or Android device backups? If yes, is it encrypted and how can users remove it?
14. What data is held in temporary storage, local preferences, logs, caches or keychain/secure storage?
15. Confirm the production Supabase project region. Is all primary database and authentication data stored in Frankfurt?
16. Are any other databases, object-storage services, edge functions, external APIs or serverless services used?
17. Is data encrypted in transit and at rest in Supabase? Are encryption keys managed by Supabase or by Moraki?
18. Who can technically access production data: application users, developers, company administrators, Supabase personnel and other providers?
19. Can administrators or developers view baby health records directly in production? Are these accesses restricted, logged or subject to special procedures?
20. What security measures protect the backend, including Row Level Security, API permissions, service-role secrets, rate limits and administrator authentication?

## SECTION B — Accounts, Authentication & User Identity (Privacy Policy, Terms of Use, Legal Notice)

### B1. Account creation

21. Is an account optional for every function except cloud synchronisation and household sharing?
22. Which login methods are actually enabled: email OTP, Sign in with Apple, Google sign-in or others?
23. For each authentication method, what information do we receive and store (email, provider ID, display name, profile picture, etc.)?
24. Which email delivery service sends authentication emails? What information does the provider receive, and where is it processed?
25. Are login codes, authentication events, IP addresses, unsuccessful attempts or session histories logged? If yes, for how long and by which provider?
26. Does Sign in with Apple work with private relay email addresses? Can users still receive all necessary account and legal communications?
27. Can a user link multiple login methods to the same account? How are duplicate or conflicting identities handled?
28. What happens to an existing local baby record when a person logs into a different account on the same device?

### B2. Adult eligibility and guardian authority

29. Is there a minimum age requirement enforced by the app?
30. Does the app require the person creating a household to confirm that they are the baby's parent or legal guardian?
31. What is the exact text of that declaration, and at which stage is it displayed?
32. Is the declaration mandatory before creating a baby profile or uploading health data?
33. Is parental/legal guardian status independently verified, or is it self-declared?
34. Is the declaration stored with a timestamp and version? If so, where and for how long?
35. Can a grandparent, nanny or unrelated caregiver create a household despite the intended guardian-only rule?
36. Can a household originally created by a guardian subsequently be transferred to a non-guardian owner?
37. Is there any functionality to identify, invite or register a second parent/legal guardian separately from ordinary caregivers?
38. What happens if another legal guardian contacts support requesting access, an objection to processing, or deletion?

## SECTION C — Baby Profiles & Data Collection (Privacy Policy, Medical Disclaimer, Data Deletion Policy)

### C1. Baby information

39. List every field collected about a baby, including optional fields and those not visible in the main UI.
40. Which fields are mandatory for creating a baby profile?
41. Can users enter a nickname or pseudonym instead of the baby's real name?
42. Can a household contain multiple babies? Can the same baby belong to multiple households?
43. What information is stored for each of the following features?
    - Feeding and breastfeeding
    - Bottle feeding and milk types
    - Sleep sessions and timers
    - Diaper changes
    - Pumping and breast milk stock
    - Temperature and health notes
    - Medication name and dosage
    - Weight and growth measurements
    - Doctor appointments
    - Reminders
    - Reports and exports
44. Are there additional fields such as height, allergies, symptoms, developmental milestones, diagnoses or vaccination information?
45. Can users upload photos, files, scanned documents, prescriptions, audio recordings or other attachments?
46. Can free-text notes contain unlimited text, or are character limits enforced? Confirm the limits for every relevant field.
47. Can free-text fields contain information about the parent's health, breastfeeding, medical conditions or other adults?
48. Does the app collect any data automatically from sensors, Apple Health, Health Connect, wearables, location services or other applications?
49. Is any third-party API used to enrich, validate, classify or analyse baby information?
50. Does the app transmit baby health data to any service that is not strictly necessary for the core functionality?

### C2. Technical metadata

51. Does every record include a creator ID, timestamp, modification timestamp, device ID or other metadata?
52. Can household members see the name or identity of the adult who created or modified each entry?
53. Can records be edited by another caregiver? Is the original information or edit history retained?
54. Does the duplicate-entry detection feature compare records made by different caregivers? What data does it process and display?
55. Are database IDs, household IDs or baby IDs accessible through app URLs, invite links, reports or logs?

## SECTION D — Households, Sharing & Permissions (Privacy Policy, Terms of Use, Data Deletion Policy)

### D1. Household permissions

56. Confirm all current roles (Owner, Caregiver, Viewer), their permissions and restrictions.
57. Can every invited member see all historical baby information, including entries created before they joined?
58. Can a guardian restrict caregivers from seeing particular categories, such as medication or sensitive health notes?
59. Who can create, edit, delete and export baby records?
60. Who can invite members, change permissions, remove members, transfer ownership and delete the household?
61. Are permissions enforced in Supabase/database policies, or only hidden in the UI?
62. Can one user belong to multiple households? Are those households technically isolated?

### D2. Invitations and access

63. How are invite codes or links generated, and what information do they contain?
64. How long do invitations remain valid? Can they be revoked, reused or forwarded?
65. Can an invitation accidentally give access to the wrong household?
66. What information can a recipient see before accepting an invitation?
67. Is the invited caregiver shown exactly what information they will be able to access before joining?
68. What acknowledgment, agreement or consent must a caregiver provide before accessing the baby's records?
69. Can an invited caregiver access information if the household guardian has withdrawn consent or authorisation?

### D3. Removing people

70. What happens immediately when a caregiver is removed from a household?
71. Are their Supabase access rights revoked immediately, including existing sessions and realtime connections?
72. Does previously synchronised baby data remain stored on their device?
73. Can a removed caregiver access cached information while offline?
74. Does the app remotely remove the household's stored records when that device reconnects?
75. Can a removed caregiver retain or use previously downloaded PDFs or exports?
76. What happens to records previously created by the removed caregiver? Do they remain attributed to that person?
77. What happens when the household owner leaves? Can ownership be transferred, and to whom?
78. Is there any special process for disputed parental authority, custody changes or a request to revoke another guardian's access?

## SECTION E — Consent, Acceptance & Withdrawal (Privacy Policy, Terms of Use)

### E1. Consent collection

79. At which precise steps does Moraki show its Privacy Policy, Terms of Use and health-data consent information?
80. Provide the exact current English and Greek wording of every consent or agreement screen.
81. Are acceptance of Terms, acknowledgment of the Privacy Policy, declaration of guardian authority and explicit health-data consent separate actions?
82. Can users refuse cloud health-data processing while continuing to use local-only functionality?
83. Is any health-related data uploaded before the relevant consent or authorisation has been recorded?
84. Is consent affirmative and voluntary, without preselected checkboxes or misleading buttons?
85. Does the system record the consent text version, purpose, timestamp and user/guardian identity?
86. Can a user access the consent record and see what they previously agreed to?
87. How are users informed when legal documents change? Is renewed consent requested when necessary?

### E2. Consent withdrawal

88. Where can users withdraw consent or other relevant permissions?
89. Describe the exact technical behaviour when a caregiver withdraws: server access, device cache, existing records, new entries and notifications.
90. Describe the exact behaviour when the household's legal guardian withdraws authorisation for the baby's health-data processing.
91. Does withdrawal currently stop only future synchronisation, while all earlier records remain available on the server?
92. Can an owner continue to use or share historical health records after withdrawing the very consent relied on to store them?
93. Is withdrawal recorded, and can it be reversed? What happens if the user later reconsents?
94. Does withdrawal affect other household members' access or previously exported data?

## SECTION F — Retention, Deletion & Data Subject Rights (Privacy Policy, Data & Account Deletion Policy)

### F1. Individual records

95. What happens in the database when someone deletes a feed, sleep entry, medication or health note?
96. Is deletion implemented using a `deleted_at` flag or a different mechanism?
97. Does the complete original record remain in Supabase after soft deletion?
98. Can anyone retrieve soft-deleted entries using administrator tools, database queries or app APIs?
99. Is there currently any scheduled job that permanently removes soft-deleted entries?
100. If deletion markers are necessary for offline synchronisation, how long must they technically remain?
101. Can the system permanently remove the record content while preserving a minimal deletion marker?
102. What happens if an offline device reconnects after a deleted record has been permanently removed? Can it accidentally recreate the record?

### F2. Household and account deletion

103. Describe exactly what happens when a user deletes their account.
104. Describe exactly what happens when an owner deletes a household.
105. Are these separate operations with different consequences?
106. Does deleting an account delete the person's past records, attribution, contact details, authentication records and local data?
107. If the user is part of a shared household, what information remains available to other members?
108. Can the last remaining owner delete their account while other members still belong to the household?
109. When a baby profile is deleted, are feeds, health notes, medication, reports, invites and associated records deleted too?
110. Are deleted users' authentication identities removed from Supabase Auth and external identity-provider associations where relevant?
111. Is locally stored information automatically deleted when an account is deleted, a household is removed or the user logs out?
112. Can users request deletion without accessing the app, for example through an email or website form?
113. How do you verify that a person requesting deletion is authorised to delete the account or the child's information?
114. Is deletion permanent, reversible or subject to a waiting period?

### F3. Backups and inactive users

115. What backups does Supabase maintain for our actual subscription and configuration?
116. How long are backups retained? Can individual customer data be selectively removed from them?
117. Do any additional backups, exports, snapshots or logs exist outside Supabase?
118. Is the intended 24-month inactivity deletion process actually implemented? If not, confirm that it does not run.
119. How is inactivity currently measured, if at all?
120. What information remains stored after two years without a user opening Moraki?
121. Do we currently have any technical mechanism for identifying and deleting abandoned households?

### F4. Privacy rights

122. Can a user export all personal and baby data? Which formats are supported (JSON, CSV, PDF or others)?
123. Can users correct personal and baby information, and does the correction propagate to every authorised device?
124. Can the system fulfil a request to provide copies of all personal information about a user or child?
125. Are there procedures to identify the relevant child and verify guardian authority before processing privacy requests?
126. How are access, correction, deletion and export requests received and tracked?
127. Can the technical system fulfil a valid data deletion request without deleting unrelated information belonging to other household members?
128. What happens to reports, temporary files, server logs and backups after a deletion request?

## SECTION G — Medical Functionality & Safety (Medical Disclaimer, Terms of Use)

129. Does Moraki exclusively record, display, summarise and export information entered by users?
130. Does the application ever interpret baby health information or assess whether measurements are normal, abnormal, safe or concerning?
131. Are there growth charts, weight percentages, reference lines or comparisons against birth weight? Describe the exact calculations and messages shown.
132. Does the app use clinical guidelines, medical reference tables, percentile charts or published health standards?
133. Does the app calculate or recommend feeding quantities, sleep duration, medication dosage or treatment decisions?
134. Does it identify medical risks, symptoms, dehydration, inadequate feeding, developmental problems or any other health condition?
135. Does the app use AI, machine learning or automated rules to produce health-related recommendations?
136. Are any health alerts, warning colours or risk labels displayed?
137. Do reports or summaries add clinical interpretations, or do they only reproduce recorded information and factual totals?
138. Can Moraki automatically calculate medication dosage or suggest a medication schedule?
139. How do reminders work technically? Are they local notifications or server-generated alerts?
140. Can reminders fail because of operating-system permissions, device settings, background restrictions, connectivity or app termination?
141. Does Moraki guarantee that every notification will be delivered on time?
142. Are medication reminders or emergency-related notifications included in the current version?
143. Are there any features that could cause a user to rely on Moraki instead of contacting a healthcare professional?
144. Provide screenshots and exact text of all medical notices, warnings, health screens and PDF disclaimers.

## SECTION H — External Services, SDKs & International Transfers (Privacy Policy and Cookie Policy)

145. Provide the complete list of third-party SDKs, APIs, infrastructure providers and external services included in the iOS production build.
146. For each provider, describe its purpose, data received, server region, retention settings and whether it uses subprocessors.
147. Is Supabase the only service receiving synchronised baby health records?
148. Does Sentry receive user IDs, email addresses, household IDs, baby IDs, medical notes, request payloads or other sensitive data?
149. Is Sentry enabled in the Apple-submitted build? What region is configured, and are personal-data scrubbing and session replay settings verified?
150. Does Expo EAS Update or another update service receive IP addresses, device identifiers, installation IDs or application usage information?
151. Are Expo push notifications implemented? If so, which data passes through Expo, Apple Push Notification service and Firebase Cloud Messaging?
152. Do push notification payloads contain the baby's name, health information, feeding information or other identifying content?
153. Are Apple and Google authentication providers receiving only information necessary for login?
154. Does the app use Firebase, Google Analytics, Meta SDK, advertising identifiers, attribution SDKs or marketing measurement services?
155. Are any crash reports, device diagnostics or analytics generated automatically by libraries even though no analytics system was intentionally installed?
156. Does any service process data outside the EEA, including remote support access, subprocessors, logs or backups?
157. What data-processing agreements, vendor terms and international transfer safeguards have been accepted or signed?
158. Is any information sold, shared for targeted advertising, used for profiling or passed to data brokers?

## SECTION I — Notifications, Reports, Exports & Communications (Privacy Policy, Terms of Use, Medical Disclaimer)

159. What notifications are currently available: feeding reminders, appointment reminders, caregiver activity alerts, account notices or promotional notifications?
160. Which permissions are requested from the operating system, and what happens if the user refuses them?
161. Does notification text expose private information on the device lock screen?
162. Are reminders stored locally, in Supabase or through an external notification provider?
163. Are notifications disabled when the user leaves a household, withdraws consent or deletes an account?
164. What information is included in generated PDF reports and any doctor-call preparation scripts?
165. Are PDFs generated entirely on the device or transmitted to a server for generation?
166. Are exported files stored temporarily, and if so, where and for how long?
167. Does Moraki automatically send information to doctors or clinics, or does the user initiate sharing through the operating system?
168. Does the app send transactional emails, support messages, marketing emails, account notices or legal updates?
169. Can users opt out of promotional communications separately from essential service notifications?

## SECTION J — Website, Cookies & Tracking (Cookie Policy, Privacy Policy, Legal Notice)

170. What framework and hosting provider does moraki.app use?
171. Which countries or regions host the website, CDN, DNS, security services and server logs?
172. Does the website set any first-party or third-party cookies?
173. Does it use local storage, session storage, tracking pixels, browser fingerprints or comparable technologies?
174. Is Google Analytics, Google Tag Manager, Meta Pixel, advertising tracking or any other analytics tool installed?
175. Does the website load third-party fonts, embedded videos, maps, chat widgets, social media plugins or remote scripts?
176. Does the website host its fonts locally or request them from external domains?
177. Does the website or CDN collect visitor IP addresses, user agents, request paths, security events or access logs? How long are those records retained?
178. Are any newsletter, contact, feedback, waiting-list or support forms present? Where is their submitted data stored?
179. Does the website use a cookie banner or privacy-preference management system? If so, what triggers it?
180. Are the English and Greek Privacy Policy, Terms, support and other legal pages publicly accessible without cookies or authentication?
181. Are privacy and contact details presented consistently across the website, app and App Store listing?

## SECTION K — Terms, Service Operations & Future Payments (Terms of Use)

182. Is Moraki currently free for every user, with no paid functionality or hidden charges?
183. Are there any limits on the number of households, babies, caregivers, records, devices or reports?
184. Can the company suspend, restrict or remove an account for security breaches, abuse or violations of the Terms? Is the mechanism implemented?
185. Is there a backup or data-recovery mechanism for user mistakes, app corruption or service interruptions?
186. What happens if cloud sync fails, data conflicts occur or the application is unavailable?
187. Can users submit user-generated content other than baby-care records, such as public posts, ratings or community contributions?
188. Does Moraki offer any public sharing, social features or communication between unrelated users?
189. Are any premium plans, in-app purchases or subscriptions already included in code but disabled?
190. If paid features are introduced, which payment system is intended (Apple In-App Purchase, Google Play Billing or another provider)?
191. Will previously created data remain accessible if users decline future paid features or cancel a subscription?
192. Is there any functionality that automatically removes features, restricts data access or deletes information when a subscription expires?
193. Does the app provide any service guarantees, uptime claims or promises of support response times?
194. Is the Moraki branding, interface and code owned by Code Designs, and are third-party and open-source licences documented?

## SECTION L — Final Release Verification (all six documents and app-store declarations)

195. Provide the final app name, iOS bundle ID, App Store version, website domain and environment identifiers.
196. Confirm whether the submitted iOS build uses exactly the services listed in this questionnaire.
197. Identify any material functionality or processing behaviour that exists in the code but is disabled through feature flags.
198. Identify all known differences between the current App Store build and the Privacy Policy or Terms currently published.
199. Verify that the app's account-deletion, household-deletion, export, consent-withdrawal and invite-revocation flows work end-to-end.
200. Provide the current English and Greek consent screens, Settings screens, account deletion screens, medical disclaimers and external provider/privacy declaration files.
201. Confirm whether any personal or health data is used for internal development, testing, debugging or support access.
202. Confirm whether any unlisted third party can receive user or baby data.
203. Identify any functionality the developer believes presents a privacy, child safety, account security or medical classification risk.
204. Identify all behaviours that are planned but not yet implemented and must therefore not be described as currently available in the legal documents.
205. Confirm the date and exact source-code version against which these answers have been verified.

## Requested deliverables from the developer

1. **Completed questionnaire:** including implementation status for each answer.
2. **Data inventory and data-flow diagram:** device → provider → storage region → retention/deletion.
3. **SDK and external service inventory:** production iOS build and website, including versions and data shared.
4. **Supabase database schema and permission summary:** tables, sensitive fields, Row Level Security and relevant deletion rules.
5. **Consent and sharing flow description:** including exact wording and saved consent metadata.
6. **Deletion and retention flow description:** record deletion, household deletion, account deletion, local cache and backups.
7. **Relevant screenshots:** onboarding, consent, invitations, permissions, Settings, deletion and medical screens.
8. **Known implementation gaps:** prioritised by severity before public release.
9. **Version confirmation:** which features are actually in the submitted App Store build versus planned for later.

**Important:** Do not provide real user data, passwords, API secrets, access tokens, encryption keys or production database dumps. Sanitised configuration evidence and code references are sufficient.

The purpose of these answers is to prepare accurate legal disclosures, identify necessary implementation changes and support a subsequent review by a qualified Cyprus lawyer. Completing the questionnaire does not itself establish GDPR compliance.
