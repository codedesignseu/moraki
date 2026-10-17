# Turns copies of the G design screens into screens/en. Copy them in first, from the repo root:
#   S=design/moraki-final-app/screens; D=design/app-store-screenshots/screens/en
#   cp $S/tabs/home-day.html $D/01-home.html; cp $S/sheets/feed-bottle-day.html $D/02-feed.html
#   cp $S/tabs/history-day.html $D/03-history.html; cp $S/tabs/trends-day.html $D/04-trends.html
#   cp $S/tabs/home-night.html $D/05-night.html; cp $S/account/invite-day.html $D/06-invite.html
# then: python3 design/app-store-screenshots/tools/edit-en.py && python3 design/app-store-screenshots/tools/make-el.py
import re, sys, pathlib
D = pathlib.Path(__file__).resolve().parent.parent / 'screens' / 'en'

def seq(h, pairs, name):
    cur = 0
    for old, new in pairs:
        i = h.find(old, cur)
        if i < 0:
            sys.exit(f'{name}: not found after {cur}: {old[:80]!r}')
        h = h[:i] + new + h[i+len(old):]
        cur = i + len(new)
    return h

def height(h):
    return re.sub(r'(<div style="width: 390px; height: )\d+px', r'\g<1>847px', h, count=1)

PLUS_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 6v12M6 12h12"></path></svg>'

def home(h, night, soft, ink, line_col):
    h = height(h)
    h = h.replace('>+</span></span>', '>' + PLUS_SVG + '</span></span>')
    next_side = f'<div style="font-size: 14px; font-weight: 700; color: {ink}">Next side: right</div>'
    if night:
        T = dict(rem='Feed reminder at 04:47', feed='Last 01:47', sleep='Awake 22 min', diaper='Last 01:40',
                 c=('2','2','10.5','90'), detail='Wet 2 · Dirty 1 · Breastfeeding 18 min', s24='Sleep in the last 24 h: 10 h 30 min',
                 recent=[('01:47 · Breastfeed, Left side','You'),('01:40 · Diaper, Wet and dirty','You'),('00:20 · Bottle, 90 ml breast milk','Parent 2')])
    else:
        T = dict(rem='Feed reminder at 17:10', feed='Last 14:10', sleep='Awake 3 h 00', diaper='Last 13:40',
                 c=('6','5','11.5','520'), detail='Wet 4 · Dirty 2 · Breastfeeding 1 h 15 min', s24='Sleep in the last 24 h: 11 h 30 min',
                 recent=[('14:10 · Bottle, 90 ml formula','Parent 2'),('13:40 · Diaper, Wet','You'),('12:05 · Sleep, 1 h 20','Grandparent')])
    note = lambda txt: f'<div style="font-size: 13px; font-weight: 600; line-height: 1.35; color: {soft}">{txt}</div>'
    pairs = [
        ('>Feed reminder at 23:54<', '>' + T['rem'] + '<'),
        ('>Last 21:40<', '>' + T['feed'] + '<'),
        ('>Awake 1 h 05<', '>' + T['sleep'] + '<'),
        ('>Last 22:10<', '>' + T['diaper'] + '<'),
        ('>6<', '>' + T['c'][0] + '<'), ('>5<', '>' + T['c'][1] + '<'), ('>11.5<', '>' + T['c'][2] + '<'), ('>520<', '>' + T['c'][3] + '<'),
        ('>ml bottle</div></div></div>', '>ml bottle</div></div></div>' + note(T['detail']) + note(T['s24'])),
        ('>Thu 8 Oct, 10:30 · Doctor name<', '>Fri 16 Oct, 10:30<'),
        ('Oldest bag is 3 days old</div>', 'Fridge: oldest bag is 2 days old</div>' + note('Freezer: oldest bag is 12 days old')),
        ('>Recent</div>', '>Recent</div>' + note('Last entry by Parent 2' if not night else 'Last entry by Parent 2')),
    ]
    # inject next side line before the reminder (do before seq so positions hold)
    h = h.replace('<div style="font-size: 14px; font-weight: 600; color: %s">Feed reminder' % soft, next_side + '<div style="font-size: 14px; font-weight: 600; color: %s">Feed reminder' % soft, 1)
    for (t, by), (ot, oby) in zip(T['recent'], [('21:40 · Bottle 90 ml, formula','Parent 2'),('21:10 · Diaper, wet','Parent 1'),('19:55 · Sleep 1 h 20','Parent 1')]):
        pairs.append(('>' + ot + '<', '>' + t + '<'))
        pairs.append(('>' + oby + '<', '>' + by + '<'))
    h = seq(h, pairs, 'home')
    # app: the appointment card also has an outlined "+ Add an appointment" pill
    border = '#CFCCC3' if not night else '#4A443D'
    pill = (f'<button style="align-self: flex-start; padding: 0 18px; min-height: 48px; border: 1.5px solid {border}; border-radius: 24px; background: transparent; color: {ink}; font: inherit; font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px">'
            + PLUS_SVG.replace('width="16" height="16"', 'width="18" height="18"') + 'Add an appointment</button>')
    i = h.find('>Fri 16 Oct, 10:30<'); j = h.find('›</span></div></div>', i)
    h = h[:j] + '›</span></div>' + pill + '</div>' + h[j+len('›</span></div></div>'):]
    return h

# 01 home day
h = (D/'01-home.html').read_text()
(D/'01-home.html').write_text(home(h, False, '#5C5852', '#161412', '#E4E2DA'))
# 05 home night
h = (D/'05-night.html').read_text().replace('#B8AD9F', '#BBB0A2')
b = re.search(r'border: 1.5px solid (#[0-9A-Fa-f]{6}); border-radius: 24px; background: transparent; color: #F1EAE0', h)
print('night outline', b and b.group(1))
(D/'05-night.html').write_text(home(h, True, '#BBB0A2', '#F1EAE0', None))

# 02 feed
h = height((D/'02-feed.html').read_text())
h = h.replace('>+</span></span>', '>' + PLUS_SVG + '</span></span>')
h = seq(h, [
    ('>Feed reminder at 23:54<', '>Feed reminder at 17:10<'),
    ('>Last 21:40<', '>Last 14:10<'), ('>Awake 1 h 05<', '>Awake 3 h 00<'), ('>Last 22:10<', '>Last 13:40<'),
    ('>Now · 22:40 · Parent 1<', '>Now · 16:25 · Parent 1<'),
    ('>Today, 22:40 · now</span></div></label>', '>Today, 16:25 · now</span></div><span style="align-self: flex-start; min-height: 34px; display: flex; align-items: center; padding: 0 14px; border-radius: 17px; background: #F3F2EE; font-size: 14px; font-weight: 600; color: #161412">At 16:25</span></label>'),
], 'feed')
m = re.search(r'<div role="radiogroup" aria-label="Milk type".*?</div>', h)
seg = m.group(0)
on = re.search(r'<button role="radio" aria-checked="true".*?</button>', seg).group(0)
off = re.search(r'<button role="radio" aria-checked="false".*?</button>', seg).group(0)
new = (seg[:seg.find('<button')].replace('repeat(2,', 'repeat(3,')
       + off.replace('>Breast milk<', '>Breast milk<') + on + off.replace('>Breast milk<', '>Mixed<') + '</div>')
h = h.replace(seg, new)
# formula selected: the app shows no "From stock" choice
m = re.search(r'<div role="switch".*?</span></span></div>', h)
h = h.replace(m.group(0), '')
(D/'02-feed.html').write_text(h)

# 03 history
h = height((D/'03-history.html').read_text())
rows = [('21:40 · ','Bottle 90 ml, formula','Parent 2','14:10 · ','Bottle, 90 ml formula','Parent 2'),
        ('21:10 · ','Diaper, wet','Parent 1','13:40 · ','Diaper, Wet','You'),
        ('19:55 · ','Sleep 1 h 20','Parent 1','12:05 · ','Sleep, 1 h 20','Grandparent'),
        ('18:30 · ','Breast, left 12, right 8 min','Parent 1','11:30 · ','Breastfeed, Left side','You'),
        ('17:05 · ','Health note, 37.2 °C','Parent 2','10:15 · ','Health note, 37.2 °C','Parent 2'),
        ('23:15 · ','Pump 120 ml, to fridge','Parent 1','23:15 · ','Pump','You'),
        ('22:00 · ','Bottle 80 ml, breast milk','Parent 2','22:00 · ','Bottle, 80 ml breast milk','Parent 2'),
        ('21:35 · ','Diaper, wet and dirty','Parent 2','21:35 · ','Diaper, Wet and dirty','Grandparent')]
pairs = []
for a,b,c,x,y,z in rows:
    pairs += [('>'+a+'<','>'+x+'<'),('>'+b+'<','>'+y+'<'),('>'+c+'<','>'+z+'<')]
h = seq(h, pairs, 'history')
(D/'03-history.html').write_text(h)

# 04 trends
h = height((D/'04-trends.html').read_text())
total = lambda txt: f'<div style="font-size: 14px; font-weight: 600; line-height: 1.35; color: #5C5852;">{txt}</div>'
# last bar label: "Today", bold like the app's current bar
h = h.replace('<span style="font-size: 12px; font-weight: 600">Tue</span>', '<span style="font-size: 12px; font-weight: 700">Today</span>')
charts = [m.end() for m in re.finditer(r'aria-label="(Bottle|Breast)[^"]*per day[^"]*"', h)]
print('charts', len(charts))
# insert totals after each chart grid: find the closing of each chart grid (7 bars)
def after_grid(h, start, text):
    depth = 0; i = h.rfind('<div', 0, start)
    j = i
    while True:
        o = h.find('<div', j); c = h.find('</div>', j)
        if o != -1 and o < c: depth += 1; j = o + 4
        else:
            depth -= 1; j = c + 6
            if depth == 0: break
    return h[:j] + total(text) + h[j:]
h = after_grid(h, charts[1], '7 days: 10 h 5 min')
h = after_grid(h, charts[0], '7 days: 3,420 ml')
# Days card: rebuild with the app's columns and total row
s = h.find('>Days</div>'); s = h.rfind('<div style="background: #FFFFFF', 0, s)
e = h.find('<div style="background: #FFFFFF', s + 10)
cols = 'grid-template-columns: 1.6fr 1fr 1fr 1fr 1.2fr; gap: 4px'
rowsd = [('Wed','8','7','3','11 h 50'),('Thu','9','6','2','12 h 20'),('Fri','8','7','3','11 h 05'),('Sat','7','6','2','12 h 40'),
         ('Sun','8','6','2','11 h 45'),('Mon','9','7','3','12 h 10'),('Today','6','4','2','8 h 40')]
tot = ('7 days','55','43','17','80 h 30')
def r(cells, w=600):
    return f'<div style="min-height: 44px; display: grid; {cols}; align-items: center; border-top: 1px solid #E4E2DA; font-size: 15px; font-weight: {w}">' + ''.join(f'<span>{c}</span>' for c in cells) + '</div>'
card = ('<div style="background: #FFFFFF; border-radius: 26px; padding: 16px 18px; display: flex; flex-direction: column; gap: 6px;"><div style="font-size: 18px; font-weight: 700; line-height: 1.35;">Days</div>'
        f'<div style="display: grid; {cols}; font-size: 13px; font-weight: 600; color: #5C5852"><span>Day</span><span>Feeds</span><span>Wet</span><span>Dirty</span><span>Sleep</span></div>'
        + ''.join(r(x) for x in rowsd) + r(tot, 800) + '</div>')
h = h[:s] + card + h[e:]
h = h.replace('>Since last<', '>Since birth<')
(D/'04-trends.html').write_text(h)

# 06 invite
h = height((D/'06-invite.html').read_text())
small = lambda txt, col='#5C5852', size=13: f'<div style="font-size: {size}px; font-weight: 600; line-height: 1.35; color: {col}">{txt}</div>'
h = seq(h, [
    ('>Caregivers can log. Viewers can only look.<', '>They can log entries and edit them, like you.<'),
    ('>Create invite<', '>Create another invite<'),
    ('>Caregiver · expires 13 Oct<', '>Works until Tue 20 Oct, 16:25<'),
    ('Share</button>', 'Share</button>' + small('One person can use this code, once.', '#5C5852', 15)),
    ('>Caregiver · expires 13 Oct<', '>Caregiver · until Tue 20 Oct, 16:25<'),
    ('>Viewer · expires 11 Oct<', '>Viewer · until Sun 18 Oct, 09:10<'),
], 'invite')
i = h.rfind('Revoke</button></div></div>')
h = h[:i] + 'Revoke</button></div>' + small('Revoking stops the code working straight away, for anyone who has the link.') + '</div>' + h[i+len('Revoke</button></div></div>'):]
(D/'06-invite.html').write_text(h)
print('ok')
