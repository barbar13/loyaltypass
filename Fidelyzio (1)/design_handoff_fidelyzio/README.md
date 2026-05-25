# Handoff : Fidelyzio — Landing Page

## Overview

Fidelyzio est une plateforme SaaS de fidélité pour commerçants de proximité français (cafés, restaurants, salons, clubs de sport, retail). Le produit fournit une carte de fidélité digitale universelle accessible via un simple QR code — sans appli mobile à installer côté client.

Ce handoff contient la **landing page complète** : hero, bénéfices clés, comment ça marche, types de commerces supportés, tarif, FAQ, CTA final, footer.

---

## About the Design Files

Le fichier `Fidelyzio.html` dans ce bundle est une **référence de design créée en HTML** — un prototype haute-fidélité qui montre l'apparence visuelle et le comportement attendus. **Ce n'est pas du code de production à copier-coller directement**.

La tâche : **recréer ce design dans l'environnement du codebase cible** (Next.js, Nuxt, Astro, etc.) en utilisant les patterns, libraires de composants et conventions déjà en place dans le projet. Si aucun environnement n'existe encore, choisir le framework le plus approprié (Next.js + Tailwind recommandé pour ce type de landing) et y implémenter les designs.

---

## Fidelity

**Haute-fidélité (hifi)** — couleurs, typographie, espacements, interactions et copy sont finalisés. Le développeur doit reproduire l'UI pixel-perfect en utilisant les libraires existantes du codebase.

---

## Design Tokens

### Colors

| Token | Valeur | Usage |
|---|---|---|
| `--bg` | `#FAF6EE` | Background principal (warm cream) |
| `--bg-2` | `#F1EADC` | Background alterné (sand pâle) — sections Bénéfices, Commerces, FAQ |
| `--bg-3` | `#EBE2D0` | Bg accentué |
| `--ink` | `#1A1410` | Texte principal, fonds sombres (espresso) |
| `--ink-2` | `#3B342C` | Texte secondaire |
| `--muted` | `#6B6358` | Texte tertiaire / labels |
| `--line` | `#E4DBC7` | Bordures fines |
| `--line-2` | `#D6CAB0` | Bordures plus marquées |
| `--amber` | `#F59E0B` | Accent principal — CTAs, focus, accents |
| `--amber-2` | `#D97706` | Accent foncé / hover |
| `--amber-soft` | `#FEF3C7` | Background pâle des badges ambre |
| `--green` | `#1F7A4D` | États succès |
| `--card` | `#FFFFFF` | Cards |
| Card warm white | `#FFFCF6` | Cards (warm-toned white plutôt que pur) |

### Typography

- **Famille unique** : `Geist` (variable, via Google Fonts) — poids 300/400/500/600/700/800
- **Mono** : `Geist Mono` — pour labels mono, valeurs numériques, badges techniques
- Letter-spacing négatif sur les grands titres : `-0.025em` à `-0.045em`
- `text-wrap: balance` sur les h1/h2/h3
- `text-wrap: pretty` sur les paragraphes longs

#### Type scale

| Element | Size | Weight | Letter-spacing | Line-height |
|---|---|---|---|---|
| h1 (hero) | `clamp(40px, 5.4vw, 76px)` | 600 | `-0.035em` | 1.02 |
| h2 | `clamp(30px, 3.6vw, 50px)` | 600 | `-0.03em` | 1.05 |
| h3 | 22px | 600 | `-0.02em` | 1.2 |
| Body / lead | 18px | 400 | — | 1.55 |
| Body small | 14-15px | 400 | — | 1.45-1.55 |
| Mono labels | 11-13px | 500 | `0.01em-0.08em` (caps tracking) | — |
| Stat numbers | 18-22px | 500 | `-0.02em` | 1.2 |
| Price amount | 68px | 500 | `-0.045em` | 1 |

### Spacing & radii

- Padding sections : `96px 0` (desktop), `64px 0` (tablette), `40px 0` (mobile)
- `--radius` : `14px` (cards small)
- `--radius-lg` : `22px` (cards grandes)
- Card padding interne : `24px` (small) à `40px` (pricing)
- Grid gap : `14-24px` selon contexte

### Shadows

- Card hover : `0 18px 30px -20px rgba(245,158,11,0.3)` (halo ambre)
- Phone mockup : `0 50px 80px -30px rgba(26,20,16,0.45), 0 24px 40px -20px rgba(26,20,16,0.3), inset 0 0 0 1px rgba(255,255,255,0.04)`
- Pricing card sombre : `0 30px 60px -30px rgba(26,20,16,0.45)`
- Floating cards : `0 18px 36px -16px rgba(26,20,16,0.35)`
- Button amber hover : `0 12px 26px -10px rgba(0,0,0,0.55)`

---

## Section-by-section

### 1. Nav (sticky)

- Hauteur 72px, bg `rgba(250,246,238,0.85)` + `backdrop-filter: blur(10px)`
- Border-bottom apparaît au scroll (`scrollY > 8`)
- Left : Logo brand-mark (carré sombre 30×30 avec losange ambre à l'intérieur) + wordmark "Fidelyzio"
- Center : 5 liens nav (`Comment ça marche`, `Commerces`, `Tarifs`, `FAQ`, `Ressources`), 14px, `white-space: nowrap`
- Right :
  - Sélecteur langue FR (drapeau + flèche)
  - **Groupement portails** dans un container pill : `Espace client` + séparateur vertical + `Espace commerçant` (icônes Lucide-style)
  - CTA primaire : `Commencer gratuitement` (btn-amber : gradient ink → 2A211B, texte crème, flèche animée +3px au hover)

**Breakpoints nav** :
- `<1180px` : masquer lien "Ressources" et le groupement portails
- `<980px` : masquer toute la nav centrale

### 2. Hero

- Grid 2 colonnes 1.05fr / 1fr, gap 64px
- **Gauche** :
  - Eyebrow pill avec dot ambre pulsant
  - h1 avec mot souligné en ambre semi-transparent (`<em>` avec `<span class="underline">`)
  - Sous-titre 19.5px, max-width 560px
  - Duo CTAs : primaire "Commencer gratuitement" + ghost "Voir une démo en 2 min"
  - **Trust chips** (3 pilules arrondies sous les CTAs) :
    - La 1ère "14 jours d'essai gratuit" est **mise en avant** : gradient `#FFF4D9 → #FEF3C7`, bordure `#FACC15`, ombre ambre, check ambre plein
    - Les 2 autres ("Sans engagement" / "Sans appli mobile") sont en chips crème neutres
- **Droite — Phone mockup hyper-réaliste** (cf. § Phone mockup ci-dessous) entouré de 3 floating cards en absolute :
  - FC-1 (top-left) : icône étoile ambre · "+50 points" · "Café du Marché · à l'instant"
  - FC-2 (bottom-right) : icône check vert · "Récompense débloquée" · "10ème café offert"
  - FC-3 (right-middle) : icône QR · "Scan QR" · "Universel · multi-commerce"
  - Animation `float` infinite 5s, delays décalés (0.2s, 1.1s, 2s)

### 3. Section Bénéfices (sand bg)

- 4 cards identiques en style aux cards "Commerces" : bg `#FFFCF6`, border `--line`, radius 18px, padding 24px, min-height 200px
- Hover : translateY(-3px) + border ambre + box-shadow ambre
- Layout interne : icon 44×44 en haut (bg `--bg`, border, color ink) → titre 18px + description 13.5px muted en bas (`justify-content: space-between`)
- Contenu : Sans appli mobile / Carte QR universelle / Points & tampons / RGPD · Hébergé en France

### 4. Comment ça marche

- bg cream, eyebrow centré
- 3 étapes en grid, chaque step est une card `#FFFCF6` border radius 22px
- Hover : translateY(-4px) + shadow espresso
- Layout step :
  - Step-num mono : carré ink 28×28 avec chiffre ambre + label CAPS
  - h3 22px
  - p 15px muted
  - Visual 180px bg `--bg` border, radius 14px :
    - Step 1 : dashboard mini avec barres ambre/ink animées
    - Step 2 : **QR scan animé** (cf. § QR Generator)
    - Step 3 : grille stamps avec récompense en pill ambre-soft

### 5. Commerces (sand bg)

- Grid 6 colonnes, cards en spans variables (2/2/2/3/3/4) façon bento
- Card style identique aux bénéfices
- Card "feat" (Cafés & Restaurants) : bg `#1A1410` color amber pour l'icône, spans 3
- Card "large" (Commerces de détail) : icône en amber-soft, spans 4

### 6. Pricing

- Grid 2 colonnes 1.05fr / 1fr
- **Carte principale (sombre)** :
  - bg `#1A1410`, color cream, border-radius 24px, padding 40px
  - Halo radial ambre top-right (280px diameter)
  - Titre + h3 "Tout inclus, un seul tarif"
  - Prix 68px : `29€` + `/ mois`
  - Feature list avec coches ambre rondes 20×20
  - CTA pleine largeur ambre + fine print
- **Side cards** :
  - 3 cards `#FFFCF6` empilées
  - 3ème card : gradient amber-soft → cream

### 7. FAQ (sand bg)

- Grid 1fr / 1.4fr, gap 64px
- Gauche : eyebrow + h2 + description + bouton "Nous contacter"
- Droite : liste accordéon, `border-top` + `border-bottom` sur chaque item
- Icône +/× : cercle 32×32, border `--line-2`, rotate 45deg quand ouvert + bg ink + color amber
- Une seule FAQ ouverte à la fois (logique JS)
- Transition max-height + opacity 0.35s

### 8. CTA final

- bg cream, contenu dans une box `#1A1410` radius 32px padding 80×64
- Grid 1.4fr / 1fr
- Halo radial ambre top-right (420px)
- Gauche : eyebrow ghost (bg semi-transparent) + h2 cream + p cream-muted + duo CTAs (ambre + ghost transparent)
- Droite : 3 méta-cards alignées verticalement (icône ambre carrée 36×36 + 2 lignes texte)

### 9. Footer

- Grid 1.5fr + 4 colonnes (Produit / Commerces / Ressources / Entreprise)
- Brand block avec 2 tags : "🇫🇷 Hébergé en France" / "RGPD"
- Foot-bottom : copyright simple + 4 liens légaux

---

## Phone mockup (hero)

Le mockup téléphone du hero est un dessin CSS hyper-réaliste — pas une vraie image. À recréer en composant React/Vue avec :

### Châssis (effet titanium)
- Dimensions : 300×608, `border-radius: 52px`, `rotate(-3deg)` au repos, `rotate(-1deg) translateY(-4px)` au hover
- **Bezel** : gradient 6-stops simulant un brossé métallique :
  ```
  linear-gradient(135deg,
    #3a3a3e 0%, #18181b 18%, #2a2a2e 35%,
    #0e0e10 55%, #1e1e22 78%, #0a0a0c 100%)
  ```
- **5 box-shadows empilées** : 3 ambient (60/40/14px), 1 inset top highlight (`rgba(255,255,255,0.12)`), 1 inset bottom shadow (`rgba(0,0,0,0.6)`)
- **Side buttons** : 4 pseudo-buttons (silent / vol up / vol dn / power) en `position:absolute`, débordant légèrement, avec inset shadow double
- **Highlight latéral** : pseudo-élément `::before` sur le côté gauche, gradient vertical multi-stops simulant un reflet métallique
- **Highlight top** : pseudo-élément `::after` en barre horizontale fine au-dessus du bezel

### Écran
- **Dynamic Island** : pilule noire 112×33 centrée à 11px du haut, avec petite caméra ronde 8×8 visible à droite (gradient radial simulant la lentille)
- **Wallpaper** : 3 sources lumineuses (radial ambre top-right + radial ambre bottom-left + linear cream vertical) sur fond `#FFFCF6`
- **Texture grain** : `radial-gradient` répété à 3px d'écart (effet rétine subtil)
- **Reflet glossy** : overlay diagonal `linear-gradient(150deg, rgba(255,255,255,0.22) → 0% → 0.04 → 0.1)`
- **Home indicator** : pilule 128×5 en bas, opacity 42%

### Status bar
- 50px de haut, padding 18px 28px 0
- Heure 15px, weight 600, letter-spacing -0.02em, `font-feature-settings: "tnum"`
- Signal : 4 barres verticales montantes (3.5/6/8.5/11px)
- Wi-Fi : SVG inline 2 arcs concentriques + dot
- Battery : rectangle 25×12 border 1.2px, bouton externe 2×5, fill interne 82% width

### App content
- Padding 6px 20px 24px, gap 14px
- **Header** : "Bonjour / Marie L." (greeting 11.5px muted + username 18px ink) + avatar 36×36 cercle gradient amber `linear-gradient(135deg, #FCD34D, #F59E0B 55%, #B45309)` avec triple shadow + inset highlights + text-shadow sur les initiales
- **Pass de fidélité (Apple Wallet style)** :
  - `border-radius: 20px`, padding 20px
  - **Triple background** : 2 radials ambre (top-right + bottom-left) + linear espresso vertical
  - **4 box-shadows** : 2 ambient + 2 inset highlights
  - **Stripe holographique** : pseudo-élément `::after` en gradient diagonal traversant, opacity 4-8%
  - Header : brand mark (carré 24×24 avec losange ambre brillant 10×10, glow box-shadow) + label "FIDELYZIO" CAPS + merchant aligné droite
  - Points : `46px Geist Mono`, letter-spacing `-0.05em`, text-shadow ambre subtil
  - Progress bar : gradient ambre 3-stops `#B45309 → #F59E0B → #FBBF24`, box-shadow glow + inset highlight
  - Foot : "10ème café offert" / "70%"
  - Stamps : grille 10 colonnes, stamps ON en `radial-gradient(circle at 35% 30%, #FBBF24, #F59E0B 70%)` (effet sphère 3D)
- **Ligne QR** :
  - bg `#FFFCF6` border `--line` radius 14px
  - QRbox 62×62, padding 5px, double box-shadow (ambient + inset white)
  - Mini QR SVG généré (cf. § QR Generator)
  - Chevron muted à droite

---

## QR Generator

Le projet contient un **générateur SVG inline** pour des QR codes au look réaliste (non-décodables — uniquement visuel). Fonction `buildQRs()` exécutée au load :

- Cible toutes les `<svg class="js-qr">` dans le DOM
- Génère une grille 25×25 modules
- Place 3 finder patterns 7×7 aux coins TL/TR/BL
- Place 1 alignment pattern 5×5 en BR
- Place timing patterns sur la row/col 6
- Remplit le reste avec un hash pseudo-aléatoire déterministe (seed = index du SVG → chaque QR est différent)
- Chaque module = `<rect>` 1×1 avec class `mod` (fill `#0F0B08`)

Utilisé à 2 endroits :
1. Mini QR (64×64) dans le mockup téléphone hero — "Carte universelle"
2. Grand QR (120×120) avec scanline ambre animée dans la section "Comment ça marche · Étape 2"

**Le scanline** :
- `top` animé de 8px à `calc(100% - 10px)` en 2.4s, easing `cubic-bezier(.45,0,.55,1)`, infinite
- `box-shadow` ambre glow pour l'effet lumineux
- Crochets de viseur (4 corners) en bordure ambre, façon caméra de scan

---

## Interactions & Behavior

| Élément | Comportement |
|---|---|
| Nav | Sticky, border-bottom apparaît au scroll `> 8px` |
| Smooth scroll | Tous les liens `a[href^="#"]` smooth-scroll avec offset 72px (hauteur nav) |
| FAQ accordion | Click toggle, une seule ouverte à la fois |
| Phone floating cards | Animation `translateY(-8px)` en 5s ease-in-out infinite, delays décalés |
| QR scanline | Animation top + glow 2.4s infinite |
| Btn hover | translateY(-1px) + box-shadow renforcée |
| Btn arrow icon | translateX(+3px) au hover |
| Card hover (commerces/bénéfices) | translateY(-3px) + border ambre + shadow ambre |
| Step card hover | translateY(-4px) + shadow espresso |

---

## Responsive

| Breakpoint | Comportement |
|---|---|
| `<1180px` | Masquer "Ressources" nav + portails (Espace client/commerçant) |
| `<980px` | Hero 1 colonne, steps 1 colonne, commerces 2 colonnes (toutes spans = 1), pricing 1 colonne, FAQ 1 colonne, CTA 1 colonne, footer 2 colonnes, nav-links cachés (menu mobile à implémenter), phone redimensionné 240×480 |
| `<560px` | Padding wrap réduit à 20px, stats grid 1×4 → 2×2, commerces 1 colonne, footer 1 colonne, CTA box padding 40×24 |

---

## State Management

Aucun state complexe — c'est une landing page statique. Les seuls états dynamiques :
- Sticky nav `scrolled` (toggle CSS class sur scroll)
- FAQ accordion (toggle class `open`)
- Tweaks éventuels d'animations CSS

---

## Copy (textes définitifs FR)

- **Hero h1** : "Vos clients méritent mieux qu'une carte papier."
- **Hero sub** : "Fidelyzio digitalise la fidélité de votre commerce. Points, tampons et récompenses — accessibles via un simple QR code. Sans appli mobile à télécharger."
- **CTA principal** : "Commencer gratuitement"
- **Prix** : 29€/mois, 14 jours d'essai gratuit, sans engagement
- **Tags légaux** : "Hébergé en France 🇫🇷" / "RGPD"

⚠️ **Ne jamais mentionner** :
- "Sans carte bancaire" (une CB est requise pour l'essai)
- Chiffres/stats non vérifiés (nombre de commerces partenaires, % de fidélité, durée d'installation précise)
- Noms de partenaires/intégrations non confirmés
- Adresse, RCS, ville d'hébergement spécifique

---

## Assets

Aucun asset externe — toutes les icônes sont des SVG inline (style Lucide), aucun raster, aucune image. Seule dépendance externe : Google Fonts (Geist + Geist Mono).

---

## Files

- `Fidelyzio.html` — landing complète en single-file (HTML + CSS inline + JS inline). Le développeur doit l'utiliser comme **référence visuelle exhaustive** pour reconstruire en composants framework-native dans son codebase.
- `image-slot.js` — composant web `<image-slot>` chargé dans la page (relique des itérations précédentes : la version finale utilise un mockup CSS au lieu d'une vraie image, mais l'élément `<image-slot style="display:none">` reste dans le code).
