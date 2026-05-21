# The Wall — Per-Character Knowledge Gate

This file prevents Claude from treating narrator knowledge as character knowledge.

The narrator can know everything. Characters cannot.

## The Principle

Each character knows only what their position gives them: family role, friendship, staff access, professional access, public information, social room, and proximity over time.

The public identity layer is broad in v20. Alex being Rosie Walker's grandson, Homer Wilson's line, David Wilson's son, royal-adjacent, famous, and called Prince Alex is not secret. Operational details remain private.

## The Gate

Before generating any character's spoken line, internal thought, text, post, or reaction, run this gate silently:

1. Who is speaking?
2. What positions does this character hold?
3. What does each position give them access to know?
4. Take the union of those access sets.
5. Generate only from that union.

The gate runs per character, per scene, per line.

## Public Layer

Most socially aware characters can know:

- Alex is famous and has been famous for years
- Rosie/Homer family structure in public form
- British courtesy title / Prince Alex public language
- William godfather layer
- education-first boundary expiry date and broad meaning
- Alex has not yet made a first adult-defining post-boundary move

Specialist/protocol characters know more precisely:

- Continental formal style
- Almanach / Debrett's details
- honors/orders
- cousinage

Casual public/fans know headline versions, often distorted.

## Private / Restricted Layer

Do not leak these unless the speaker has access:

- Serena Management inbox details
- al.x legal/rightsholding structure
- Electric Ivory release options and internal rights conversations
- Walker/AW governance mechanics beyond public/business-summary level
- Albury House details not shown in the 7 August Architectural Digest / YouTube feature or personally disclosed
- private chats and scrollback
- birthday gift inscriptions and private object provenance
- family grief texture beyond public biography
- staff routing and house operations

## Position Map

| Position | Public identity | Boundary / career pressure | Operations | Private family texture | Albury interior |
|---|---|---|---|---|---|
| Alex | full | full | full | full | full |
| Rosie / Homer | full | full | partial | full | partial unless shown |
| Dawson elders / closest family | full | full | partial | full/partial by line | only if shown |
| Godparents / godfamily elders | full | full | partial | partial/full by relationship | only if shown |
| Brain Trust: Apple / Iris / Lila / Kaia / Rocco | full | public speculation only, no Serena details | no | inherited close texture | only if shown/invited |
| Close peers outside Brain Trust | full | public speculation only, no Serena details | no | only what their relationship supports | only if shown/invited |
| London Lot | public/social layer | public speculation only | no Serena details | only what members personally know | only if Alex shows/invites |
| Serena Management | public layer + professional inbound | full for managed categories | Serena/al.x only | no personal chats | no unless briefed |
| AW family-office staff | public layer + role-relevant private facts | partial | role-specific | no personal chats | role-specific |
| Knight Frank / household staff | public layer + house operations | no career inbox | house/property only | no personal chats | yes for work areas |
| Walker Holdings staff | public layer + Walker institutional facts | no personal career inbox unless routed | Walker layer | no personal chats | no unless property task |
| Press / fans | public layer incl. AD/Youtube Albury feature after 7 Aug drop | public speculation only | no | no | published Albury visuals only |

## Chat-Room Seal

Each chat is a sealed room with its own scrollback, members, jokes, timing, and access.

A joke made in Boys is not automatically available to The Almanach. A Serena Management internal note is not available to Summer House. A member who belongs to two rooms may carry a thought across only if the scene visibly gives them the chance, and even then it should mutate into that room's register.

## Albury House Wall

At 7 August opening:

- public knows the house is his and has been under work
- Architectural Digest cover story and YouTube video drop with Sophie Ashby taking viewers through five floors — both basement levels, the raised ground floor, and the two guest floors (not the first-floor Music Nobile or the top-floor private suite)
- public now knows Studio Ashby / Sophie Ashby did Albury House
- public has room-by-room visual knowledge of those five floors from the published feature; the music floor and the private top floor are not seen
- Brain Trust/friends saw room details during the 5 August dinner/tour; Boys saw the house before the 7 August meeting
- wider friends / Legacy / Summer House / London Lot know at least the published AD/Youtube material once it drops, plus anything Alex personally showed them
- staff know only what their work requires

Do not let characters know staff/security operations, private handover mechanics, hidden systems/safe mechanics, Serena/AW/al.x details, or unshown private object provenance from the AD feature.

## Common Failures

- Treating public Prince Alex knowledge as a new reveal.
- Letting friends know Serena Management inbox details.
- Letting staff see personal chats.
- Treating AD-public interiors as still secret after 7 August.
- Letting press know staff/security operations, hidden systems, Serena/AW details, or private handover mechanics.
- Letting a chat recycle another chat's joke.
- Letting narrator knowledge leak into a throwaway line.
