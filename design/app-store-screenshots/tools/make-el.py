import re, pathlib, sys
R = pathlib.Path(__file__).resolve().parent.parent / 'screens'
T = {
 # home
 'Hello, Parent 1': 'Γεια σου · Γονέας 1', 'Here’s Baby’s day so far': 'Μωρό: η μέρα μέχρι τώρα',
 'Since last feed': 'Από το τελευταίο τάισμα', '2 h 15 min': '2 ώ 15 λ', 'Next side: right': 'Επόμενο στήθος: δεξί',
 'Feed reminder at 17:10': 'Υπενθύμιση ταΐσματος στις 17:10', 'Feed reminder at 04:47': 'Υπενθύμιση ταΐσματος στις 04:47',
 'Log a feed': 'Νέο τάισμα', 'Feed': 'Τάισμα', 'Sleep': 'Ύπνος', 'Diaper': 'Πάνα', 'Pump': 'Άντληση',
 'Last 14:10': 'Τελευταίο 14:10', 'Last 01:47': 'Τελευταίο 01:47', 'Awake 3 h 00': 'Ξύπνιο 3 ώ 00', 'Awake 22 min': 'Ξύπνιο 22 λ',
 'Last 13:40': 'Τελευταία 13:40', 'Last 01:40': 'Τελευταία 01:40', 'Last yesterday': 'Χθες',
 'Health note': 'Σημείωση υγείας', 'Medication': 'Φάρμακο', 'Today': 'Σήμερα', 'feeds': 'ταΐσματα', 'diapers': 'πάνες',
 'h sleep': 'ώρες ύπνου', 'ml bottle': 'ml μπιμπερό', '11.5': '11,5', '10.5': '10,5',
 'Wet 4 · Dirty 2 · Breastfeeding 1 h 15 min': 'Βρεγμένες 4 · Ακάθαρτες 2 · Θηλασμός 1 ώ 15 λ',
 'Wet 2 · Dirty 1 · Breastfeeding 18 min': 'Βρεγμένες 2 · Ακάθαρτες 1 · Θηλασμός 18 λ',
 'Sleep in the last 24 h: 11 h 30 min': 'Ύπνος το τελευταίο 24ωρο: 11 ώ 30 λ',
 'Sleep in the last 24 h: 10 h 30 min': 'Ύπνος το τελευταίο 24ωρο: 10 ώ 30 λ',
 'Next appointment': 'Επόμενο ραντεβού', 'Check-up': 'Έλεγχος', 'Fri 16 Oct, 10:30': 'Παρ 16 Οκτ, 10:30',
 'Add an appointment': 'Πρόσθεσε ραντεβού', 'Milk stock': 'Απόθεμα γάλακτος', 'Adjust': 'Αλλαγή', 'Fridge': 'Ψυγείο',
 'Freezer': 'Κατάψυξη', '1,150 ml': '1.150 ml',
 'Fridge: oldest bag is 2 days old': 'Ψυγείο: το παλαιότερο είναι 2 ημερών',
 'Freezer: oldest bag is 12 days old': 'Κατάψυξη: το παλαιότερο είναι 12 ημερών',
 'Recent': 'Πρόσφατα', 'Last entry by Parent 2': 'Τελευταία καταχώριση από Γονέας 2',
 '14:10 · Bottle, 90 ml formula': '14:10 · Μπιμπερό, 90 ml φόρμουλα', '13:40 · Diaper, Wet': '13:40 · Πάνα, Βρεγμένη',
 '12:05 · Sleep, 1 h 20': '12:05 · Ύπνος, 1 ώ 20', '01:47 · Breastfeed, Left side': '01:47 · Θηλασμός, Αριστερό στήθος',
 '01:40 · Diaper, Wet and dirty': '01:40 · Πάνα, Βρεγμένη και ακάθαρτη', '00:20 · Bottle, 90 ml breast milk': '00:20 · Μπιμπερό, 90 ml μητρικό γάλα',
 'Parent 1': 'Γονέας 1', 'Parent 2': 'Γονέας 2', 'Grandparent': 'Παππούς', 'You': 'Εσύ',
 # feed sheet
 'Now · 16:25 · Parent 1': 'Τώρα · 16:25 · Γονέας 1', 'Bottle': 'Μπιμπερό', 'Breast': 'Θηλασμός', 'Time': 'Ώρα',
 'Today, 16:25 · now': 'Σήμερα, 16:25 · τώρα', 'At 16:25': 'Στις 16:25', 'Amount': 'Ποσότητα', 'Milk': 'Γάλα',
 'Breast milk': 'Μητρικό', 'Formula': 'Φόρμουλα', 'Save feed': 'Αποθήκευση ταΐσματος',
 # history
 'History': 'Ιστορικό', 'Feeds': 'Ταΐσματα', 'Diapers': 'Πάνες', 'Health': 'Υγεία', 'Other': 'Άλλα', 'Yesterday': 'Χθες',
 'Bottle, 90 ml formula': 'Μπιμπερό, 90 ml φόρμουλα', 'Diaper, Wet': 'Πάνα, Βρεγμένη', 'Sleep, 1 h 20': 'Ύπνος, 1 ώ 20',
 'Breastfeed, Left side': 'Θηλασμός, Αριστερό στήθος', 'Health note, 37.2 °C': 'Σημείωση υγείας, 37.2 °C',
 'Bottle, 80 ml breast milk': 'Μπιμπερό, 80 ml μητρικό γάλα', 'Diaper, Wet and dirty': 'Πάνα, Βρεγμένη και ακάθαρτη',
 # trends
 'Trends': 'Τάσεις', 'Last 7 days': 'Τελευταίες 7 ημέρες', 'ml per day': 'ml ανά ημέρα', 'minutes per day': 'λεπτά ανά ημέρα',
 'Wed': 'Τετ', 'Thu': 'Πέμ', 'Fri': 'Παρ', 'Sat': 'Σάβ', 'Sun': 'Κυρ', 'Mon': 'Δευ',
 '7 days: 3,420 ml': '7 ημέρες: 3.420 ml', '7 days: 10 h 5 min': '7 ημέρες: 10 ώ 5 λ', 'Averages': 'Μέσοι όροι',
 'Bottle amount': 'Ποσότητα μπιμπερό', 'Gap between feeds': 'Χρόνος ανάμεσα στα ταΐσματα', 'Days': 'Ημέρες', 'Day': 'Ημέρα',
 'Wet': 'Βρεγμένες', 'Dirty': 'Ακάθαρτες', '7 days': '7 ημέρες', 'Weight': 'Βάρος', 'Birth': 'Γέννηση', 'Latest': 'Τελευταίο',
 'Since birth': 'Από τη γέννηση', '3,200 g': '3.200 g', '3,240 g': '3.240 g', '3,180 g': '3.180 g', '3,050 g': '3.050 g',
 'Clinic': 'Ιατρείο', 'Home': 'Σπίτι', '5 Oct · Home': '5 Οκτ · Σπίτι', '2 Oct · Clinic': '2 Οκτ · Ιατρείο',
 '29 Sep · Home': '29 Σεπ · Σπίτι', 'Add weight': 'Πρόσθεσε βάρος',
 # invite
 'Invite someone': 'Προσκάλεσε κάποιον', 'They join as': 'Μπαίνει ως', 'Caregiver': 'Φροντιστής', 'Viewer': 'Θεατής',
 'They can log entries and edit them, like you.': 'Μπορεί να καταγράφει καταχωρίσεις και να τις αλλάζει, όπως εσύ.',
 'Create another invite': 'Φτιάξε άλλη πρόσκληση', 'Invite code': 'Κωδικός πρόσκλησης',
 'Works until Tue 20 Oct, 16:25': 'Ισχύει μέχρι τις Τρί 20 Οκτ, 16:25', 'Share': 'Κοινοποίηση',
 'One person can use this code, once.': 'Ένα άτομο μπορεί να τον χρησιμοποιήσει, μία φορά.', 'Open invites': 'Ανοιχτές προσκλήσεις',
 'Caregiver · until Tue 20 Oct, 16:25': 'Φροντιστής · μέχρι Τρί 20 Οκτ, 16:25',
 'Viewer · until Sun 18 Oct, 09:10': 'Θεατής · μέχρι Κυρ 18 Οκτ, 09:10', 'Revoke': 'Ανάκληση',
 'Revoking stops the code working straight away, for anyone who has the link.': 'Η ακύρωση σταματά τον κωδικό αμέσως, για όποιον έχει τον σύνδεσμο.',
}
MIXED = ['Μικτό', 'Ανάμεικτο']  # feed kind, then milk
for f in sorted((R/'en').glob('*.html')):
    h = f.read_text()
    head, body = h.split('<body>', 1)
    head = head.replace('<html lang="en">', '<html lang="el">')
    mixed = iter(MIXED)
    missing = set()
    def sub(m):
        t = m.group(1)
        k = t.strip()
        if k == 'Mixed': return '>' + next(mixed) + '<'
        if k in T: return '>' + t.replace(k, T[k]) + '<'
        hm = re.fullmatch(r'(\d+) h (\d\d)', k)
        if hm: return f'>{hm[1]} ώ {hm[2]}<'
        if re.search(r'[A-Za-z]', k) and k not in ('ml', 'g') and not k.startswith('body{') and not re.fullmatch(r'[A-Z0-9]{4} [A-Z0-9]{4}', k):
            missing.add(k)
        return m.group(0)
    body = re.sub(r'>([^<>]+)<', sub, body)
    # visible-to-assistive labels too
    for a, b in [('aria-label="Log a feed"', 'aria-label="Καταγραφή ταΐσματος"'), ('aria-label="Close"', 'aria-label="Κλείσιμο"')]:
        body = body.replace(a, b)
    (R/'el'/f.name).write_text(head + '<body>' + body)
    print(f.name, 'untranslated:', sorted(missing) or 'none')
