# FLOWSTACK UI implementation notes

- Package: `@flowstack-ui/brick@0.3.0`, exact version pinned in `package-lock.json`.
- Exact package Agent Knowledge resolved from the installed package with zero-failure coverage. Guides consulted: layer selection, interface composition, Button, Container, Section, Grid, Stack, Card, Image, Text, Alert, EmptyState, Field, Input, NativeSelect and Textarea.
- Brick owns the homepage and catalogue page layout, typography, buttons, cards, images, alerts, empty states and shop filter controls. The application owns artwork direction, routing, catalogue data, search logic and the local promotional asset.
- The promotional hero image was generated for this application with the built-in image generation tool using this brief: “Photorealistic editorial interior photograph of an original abstract botanical painting in terracotta, sage, cream and dusty rose, framed on an ivory wall above an oak console, warm late afternoon light; no text or logo.” It is stored at `public/hero-art.png` and is not presented as a purchasable product.

## Intentional application fallbacks

- Interface job: brand navigation and footer links. Brick owner searched: NavList/NavigationMenu. The current simple link-only top navigation remains native Next.js links because it has no disclosure interaction and shares the application routing shell. Proposed owner: application. Verified by build and HTTP response.
- Interface job: editorial hero collage and category artwork. Brick owners searched: Image, Grid, Surface, ZStack. Brick Image and Grid own the media and tracks; application CSS positions only authored decorative accents. Proposed owner: application art direction. Verified by build and HTTP response.
- Interface job: missing collection message. Brick EmptyState and Alert own structure and feedback. Application copy describes database readiness without claiming live inventory. Verified by build and HTTP response.

The remaining admin and custom-art form pages still use earlier application styling. They can be migrated to Brick after the database contract is confirmed; this visual pass focused on the public storefront and catalogue.
