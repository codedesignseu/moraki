import re,json,sys,os,html
sys.path.insert(0,os.path.dirname(__file__))
from content import GUIDES,ARTICLE,INDEX
PUB=sys.argv[1]
DATE="2026-11-24"; DATE_EN="24 November 2026"; DATE_EL="24 Νοεμβρίου 2026"
SITE="https://moraki.app"
def tmpl(lang):
    return open(f"{PUB}/{'el/' if lang=='el' else ''}age-guides/index.html").read()
def esc(s): return html.escape(s,quote=True)
def page(lang,path_en,path_el,title,desc,main,ld,og_alt):
    s=tmpl(lang)
    head,rest=s.split('<body',1)
    cur=path_el if lang=='el' else path_en
    head=re.sub(r'<title>.*?</title>',f'<title>{esc(title)} · Moraki</title>',head)
    for k in ['name="description"','property="og:description"','name="twitter:description"']:
        head=re.sub(rf'(<meta {k} content=")[^"]*"',lambda m:m.group(1)+esc(desc)+'"',head)
    for k in ['property="og:title"','name="twitter:title"']:
        head=re.sub(rf'(<meta {k} content=")[^"]*"',lambda m:m.group(1)+esc(title)+' · Moraki"',head)
    for k in ['property="og:image:alt"','name="twitter:image:alt"']:
        head=re.sub(rf'(<meta {k} content=")[^"]*"',lambda m:m.group(1)+esc(og_alt)+'"',head)
    head=head.replace('/el/age-guides/',path_el).replace('/age-guides/',path_en)
    head=head.replace('content="website"','content="article"') if 'guides/' in path_en and path_en!='/guides/' else head
    head=re.sub(r'<script type="application/ld\+json">.*?</script>','<script type="application/ld+json">'+json.dumps(ld,ensure_ascii=False,separators=(',',':'))+'</script>',head,flags=re.S)
    body='<body'+rest
    pre,post=body.split('<main',1); post=post.split('</main>',1)[1]
    # nav: Age guides -> Guides, current
    def nav(x):
        x=x.replace(' aria-current="page"','')
        if lang=='el':
            x=x.replace('<a href="/el/age-guides/">Οδηγοί ηλικίας</a>','<a href="/el/guides/" aria-current="page">Οδηγοί</a>')
        else:
            x=x.replace('<a href="/age-guides/">Age guides</a>','<a href="/guides/" aria-current="page">Guides</a>')
        return x.replace('/el/age-guides/" lang="el"',path_el+'" lang="el"').replace('/age-guides/" lang="en"',path_en+'" lang="en"')
    out=nav(pre)+main+nav('</main>'+post)
    return head+out
def ldbase(lang):
    return [{"@type":"Organization","@id":SITE+"/#organization"},{"@type":"WebSite","@id":SITE+"/#website"}]
def crumbs(lang,items):
    return {"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":i+1,"name":n,"item":SITE+u} for i,(n,u) in enumerate(items)]}
def write(path,s):
    os.makedirs(os.path.dirname(path),exist_ok=True); open(path,'w').write(s)

for lang in ['en','el']:
    A=ARTICLE[lang]; I=INDEX[lang]; pre='/el' if lang=='el' else ''
    g0=GUIDES[0]; slug=g0[0]
    home=('Αρχική' if lang=='el' else 'Home'); gname=('Οδηγοί' if lang=='el' else 'Guides')
    # ---------- article ----------
    toc=''.join(f'<li><a href="#{sid}">{esc(h)}</a></li>' for sid,h,_ in A['sections'])
    secs=''.join(f'<section id="{sid}" aria-labelledby="{sid}-h"><h2 id="{sid}-h"><span class="g-num">{i+1}</span>{esc(h)}</h2>'+''.join(f'<p>{esc(p)}</p>' for p in ps)+'</section>' for i,(sid,h,ps) in enumerate(A['sections']))
    helps=''.join(f'<li><span class="tick" aria-hidden="true">✓</span><span>{esc(h)}</span></li>' for h in A['helps'])
    rel=''.join(f'<li><a class="g-card tint-{t}" href="{pre}/guides/{s}/"><span class="g-card-title">{esc(te if lang=="en" else tl)}</span><span class="small soft">{esc(se if lang=="en" else sl)}</span></a></li>' for s,t,te,tl,se,sl,m in GUIDES[1:4])
    badges=open(f"{PUB}/{'el/' if lang=='el' else ''}index.html").read()
    badges=re.search(r'<span class="badges">.*?google-play-badge[^>]*></a></span>',badges,re.S).group(0)
    main=f'''<main id="main" class="guide">
<nav class="crumbs small" aria-label="Breadcrumb"><a href="{pre}/">{home}</a> › <a href="{pre}/guides/">{gname}</a></nav>
<header class="g-head"><span class="eyebrow tint-{g0[1]}">{esc(A['eyebrow'])}</span><h1>{esc(A['h1'])}</h1><p class="lead">{esc(A['lead'])}</p>
<p class="g-meta small soft"><span>{esc(A['by'])}</span><span>{A['updated']} <time datetime="{DATE}">{DATE_EL if lang=='el' else DATE_EN}</time></span><span>{A['read']}</span></p></header>
<img class="g-art" src="/images/illustrations/night-feed.svg" alt="" width="320" height="240" fetchpriority="high">
<nav class="g-toc card" aria-labelledby="toc-h"><h2 id="toc-h" class="toc-h">{esc(A['toc_h'])}</h2><ol>{toc}</ol></nav>
<div class="g-body">{secs}
<div class="tip"><strong>{esc(A['tip_h'])}</strong><p>{esc(A['tip'])}</p></div>
<section class="card g-helps" aria-labelledby="helps-h"><h2 id="helps-h">{esc(A['helps_h'])}</h2><ul class="checks">{helps}</ul></section>
<p class="notice small">{esc(A['notice'])}</p>
</div>
<section class="g-related" aria-labelledby="rel-h"><h2 id="rel-h">{esc(A['related_h'])}</h2><ul class="g-grid">{rel}</ul></section>
<section class="card g-cta" aria-labelledby="cta-h"><h2 id="cta-h">{esc(A['cta_h'])}</h2><p>{esc(A['cta_p'])}</p>{badges}</section>
</main>'''
    url=f"{SITE}{pre}/guides/{slug}/"
    ld={"@context":"https://schema.org","@graph":ldbase(lang)+[
        {"@type":"Article","@id":url+"#article","headline":A['h1'],"description":A['lead'],"inLanguage":lang,"datePublished":DATE,"dateModified":DATE,
         "author":{"@type":"Person","name":"Makis","url":f"{SITE}{pre}/our-story/"},"publisher":{"@id":SITE+"/#organization"},
         "image":SITE+"/images/og/age-guides.png","mainEntityOfPage":url,"isPartOf":{"@id":SITE+"/#website"},"about":{"@id":SITE+"/#app"}},
        crumbs(lang,[(home,pre+'/'),(gname,pre+'/guides/'),(A['h1'],pre+f'/guides/{slug}/')])]}
    write(f"{PUB}{pre}/guides/{slug}/index.html",page(lang,f'/guides/{slug}/',f'/el/guides/{slug}/',A['h1'],A['lead'],main,ld,A['h1']))
    # ---------- index ----------
    cards=''.join(f'''<li><a class="g-card tint-{t}" href="{pre}/guides/{s}/"{'' if i==0 else ' data-draft'}><span class="eyebrow tint-{t}">{m} {'λεπτά' if lang=='el' else 'min'}</span><span class="g-card-title">{esc(te if lang=="en" else tl)}</span><span class="small soft">{esc(se if lang=="en" else sl)}</span></a></li>''' for i,(s,t,te,tl,se,sl,m) in enumerate(GUIDES))
    main=f'''<main id="main" class="guides">
<section class="page-hero" aria-labelledby="page-h"><div class="wrap"><div class="page-hero-text"><span class="eyebrow">{esc(I['eyebrow'])}</span><h1 id="page-h">{esc(I['h1'])}</h1><p class="hero-sub">{esc(I['sub'])}</p></div></div></section>
<div class="wrap stack"><ul class="g-grid">{cards}</ul>
<a class="card g-age" href="{pre}/age-guides/"><span class="g-card-title">{esc(I['age_h'])}</span><span class="small soft">{esc(I['age_p'])}</span><span class="more-link">{esc(I['age_link'])} →</span></a></div>
</main>'''
    url=f"{SITE}{pre}/guides/"
    ld={"@context":"https://schema.org","@graph":ldbase(lang)+[{"@type":"CollectionPage","@id":url+"#webpage","url":url,"name":I['h1'],"inLanguage":lang,"isPartOf":{"@id":SITE+"/#website"},
        "hasPart":[{"@type":"Article","headline":(g[2] if lang=='en' else g[3]),"url":f"{SITE}{pre}/guides/{g[0]}/"} for g in GUIDES[:1]]},crumbs(lang,[(home,pre+'/'),(gname,pre+'/guides/')])]}
    write(f"{PUB}{pre}/guides/index.html",page(lang,'/guides/','/el/guides/',I['h1'],I['sub'],main,ld,I['h1']))
print('built')
