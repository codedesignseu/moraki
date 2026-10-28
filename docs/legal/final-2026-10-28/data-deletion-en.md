# Data & Account Deletion — Moraki

**Effective date: 28 October 2026**

Moraki gives users several ways to remove information. Deleting an entry, leaving a household, deleting a household and deleting an account have different consequences.

## 1. Delete an individual entry

Open the relevant activity entry and select Delete.

It disappears from the normal household history and synchronises as deleted to authorised devices.

The record's content is removed from our active server database after up to **30 days**. A limited deletion marker remains for the lifetime of the household to prevent older offline devices from restoring the entry accidentally.

Deleted entries are excluded from ordinary exports.

## 2. Leave a household

Go to **Settings → Leave or delete** and choose the available leave option.

Your ongoing access to the shared household is removed. Entries you previously created can remain in the household for other authorised members, subject to applicable rights.

When the app confirms that your membership has ended, it clears the household's locally stored data and associated reminders from that device.

An offline device may retain cached information until it reconnects. Files previously exported or shared cannot be recalled.

## 3. Delete a household

The household owner can use **Settings → Leave or delete → Delete household**.

Deleting the household removes the baby's profile, shared care records, household membership data and associated invitations from the active service.

Other members' personal accounts are not deleted solely because the household is removed. Their devices clear household information when the deletion is confirmed after reconnection.

This operation is intended to be permanent. The backup and audit arrangements below still apply.

## 4. Delete your account

Open **Settings → Leave or delete → Delete account** and follow the confirmation process.

Your Moraki authentication account, account email and ordinary profile information are removed.

- If you are the only household member, the household is deleted with your account.
- If the household is shared, it may remain for other authorised members. Entries you contributed can remain within its history, while your display name and active account are removed.
- If ownership must be transferred, the app requires an eligible declared guardian.
- If you signed in with Apple or Google, in-app deletion attempts to revoke Moraki's connection to that provider.

Some limited personal information may still be retained for the periods described below where legally justified.

## 5. Request deletion without the app

If you cannot access Moraki, email **hello@moraki.app** with a clear description of your request.

We may ask you to confirm from the email address associated with the account or use a verification code sent to your Apple private relay address.

We do not delete another person's account merely because someone knows their details.

For requests concerning a child, we may need to verify parental responsibility or another relevant legal authority. Disputed requests are assessed individually, taking into account the child and other affected people.

We normally respond to data-protection requests within one month, subject to lawful extensions.

**Important:** Deletion requested by email does not automatically revoke Moraki's Apple or Google provider-side connection. You can disconnect it in your Apple ID or Google Account security settings.

## 6. Withdraw health-data consent

Use **Settings → Privacy → Review consent**.

Withdrawal is different from deletion. If the last guardian withdraws, the household becomes paused and remains subject to the lifecycle described in the Privacy Policy.

During a pause, members cannot create or share new records and normally see only entries they authored themselves, which they can delete.

An explicitly withdrawn household may be warned after 90 days and deleted at least 30 days afterward if authorisation is not restored.

For a non-material consent-text version update, a 90-day transition may apply; expiry of this transition alone does not start the explicit-withdrawal deletion process.

## 7. Automated inactivity deletion

A household with no qualifying activity for **23 months** is scheduled for a warning by email.

If the household remains inactive and the notification conditions are met, it can be deleted after **24 months**, no sooner than 30 days after the warning.

Any qualifying activity before deletion cancels that inactivity warning.

Deleting an inactive household does not automatically delete its members' separate accounts.

## 8. What may remain after deletion

- **Consent and agreement evidence:** limited pseudonymous records are currently retained for three years following account deletion, then removed automatically.
- **Deleted activity markers:** remain without the deleted content until the household is removed.
- **Server backups:** daily Supabase backups are retained for seven days; information removed from live storage may therefore remain temporarily within existing backups.
- **Deletion recovery records:** limited IDs, dates and reasons are kept in a restricted server log for 35 days and in protected daily journal emails for at least 35 days. They help prevent erased information from returning following a backup restoration.
- **Feedback, support messages and security records:** follow applicable retention rules and any lawful exceptions.
- **Other people's devices and exported files:** cannot always be erased immediately or recalled after being shared.

Our restoration procedure is designed to reapply recorded deletions before a restored service is made available. As with any backup system, technical recovery limitations may exist.

## 9. Exports and local files

From **Settings → Data export**, you can export available information in JSON and CSV formats. Medical-style summaries can also be generated as PDFs.

Temporary export and PDF files created within Moraki are removed after the app's sharing operation. Copies saved to Files, email, cloud drives or other destinations are controlled through those services and devices.

For locally held data, use the relevant sign-out-and-clear option or remove the app. Device-system backups and secure-storage remnants may require separate device-level management.

## 10. Further rights and contact

Deletion is not the only privacy right. You may also request access, rectification, restriction, portability or object to relevant processing under applicable law.

Send requests to **hello@moraki.app**.

**Controller:** C.E. CODE DESIGNS LTD  
Akropoleos 4, Paphos, Cyprus  
Registration: HE472540  
Privacy Policy: https://moraki.app/privacy/
