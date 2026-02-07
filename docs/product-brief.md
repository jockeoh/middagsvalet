# Product Brief (kort)

## Positionering
Middagsvalet är en beslutsmotor, inte en receptblogg. Fokus ligger på snabb onboarding, ranking och veckomeny i så få interaktioner som möjligt.

## Mått (MVP)
- TTFM (time-to-first-menu): < 3 min
- Onboarding completion: > 70%
- Menyswap latency: subjektivt "instant" (< 300ms upplevt i UI)
- Reuse: andel återkommande användning per vecka

## Principer
- Alltid mobil-first
- Förslag först, detaljer senare
- Lokalt sparad state utan konto
- Förklarbara scores per profil

## Datamodell för framtid
- Separera `household`, `user`, `membership` för delade hushåll
- Lägg `externalCartAdapter` för ICA/Willys som eget integrationslager
- Behåll scoring i `packages/shared` för återanvändning mellan API/web/future mobile app
