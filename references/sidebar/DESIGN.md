---
name: Core Enterprise HR
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#44474f'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#747780'
  outline-variant: '#c4c6d0'
  surface-tint: '#465e8b'
  primary: '#000a1f'
  on-primary: '#ffffff'
  primary-container: '#00204a'
  on-primary-container: '#7189b8'
  inverse-primary: '#aec7fa'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#000d06'
  on-tertiary: '#ffffff'
  tertiary-container: '#002718'
  on-tertiary-container: '#009c6b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d7e2ff'
  primary-fixed-dim: '#aec7fa'
  on-primary-fixed: '#001b3f'
  on-primary-fixed-variant: '#2e4772'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-bold:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-subtle:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 24px
  card-gap: 20px
  inline-gutter: 16px
  sidebar-width: 240px
---

## Brand & Style

This design system is built for high-utility enterprise environments where clarity, speed of data processing, and trust are paramount. The personality is **Corporate & Modern**, prioritizing a structured hierarchy and functional elegance over decorative flair.

The UI evokes a sense of **Reliability and Organization**. It utilizes a "Professional SaaS" aesthetic characterized by:
- **High Information Density:** Optimized for complex data sets and administrative workflows.
- **Systematic Structure:** A clear distinction between navigation (sidebar), header (context), and workspace (content).
- **Subdued Professionalism:** A palette that emphasizes content through white-space and uses high-contrast navy for authority and focus.
- **Trust-Centric:** Clean lines, subtle shadows, and a logical flow that reduces cognitive load for HR administrators.

## Colors

The color strategy is anchored in a professional **Deep Navy** used for structural navigation and primary brand presence.

- **Primary (#00204A):** Used for the sidebar, primary action buttons, and high-level headers. It provides the "anchor" for the interface.
- **Success/Status (#10B981):** A vibrant green specifically reserved for "Active" status badges and positive financial indicators.
- **Surface & Backgrounds:** The main workspace uses a very light gray (`#F8FAFC`) to differentiate from pure white (`#FFFFFF`) cards, creating a subtle layered effect that defines container boundaries without heavy borders.
- **Borders & Dividers:** A consistent light gray (`#E2E8F0`) is used for table rows, input strokes, and tab containers to maintain a clean, "airy" feel.

## Typography

This design system utilizes **Inter** for its exceptional legibility in data-heavy environments. The type scale is compact to allow for maximum information density.

- **Data Labels:** Use `label-subtle` for field names (e.g., "Fecha de Ingreso") to keep them secondary to the actual data.
- **Primary Data:** Use `body-md` or `body-sm` in a darker neutral for the actual information values.
- **Section Headers:** Use `title-sm` with a bottom border or increased spacing to define information groups (e.g., "Datos Personales").
- **Navigation:** Sidebar items use `body-sm` with a medium weight to ensure legibility against the dark background.

## Layout & Spacing

The layout follows a **Fixed Sidebar + Fluid Content** model. 

- **The Sidebar:** Fixed at 240px. It uses a vertical stack with 8px of spacing between navigation items.
- **Content Area:** A fluid container with a maximum width of 1440px for desktop to prevent line lengths from becoming unreadable.
- **Grid System:** While content is fluid, interior cards use a standard 12-column grid for alignment of data fields (e.g., 2-column or 3-column data grids within a profile view).
- **Rhythm:** A 4px baseline grid ensures consistent vertical rhythm. Standard margins for internal card padding are 24px, while dense data tables reduce this to 12px or 16px.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** and extremely **Ambient Shadows**.

1. **Level 0 (Background):** The application shell background (`#F8FAFC`).
2. **Level 1 (Cards/Containers):** Pure white (`#FFFFFF`) surfaces. These use a very soft, diffused shadow: `0px 1px 3px rgba(0,0,0,0.05), 0px 4px 6px rgba(0,0,0,0.02)`.
3. **Level 2 (Active States/Dropdowns):** Elevated elements use a slightly more pronounced shadow and a 1px border (`#E2E8F0`) to ensure separation.

The sidebar is treated as a "recessed" or "fixed" foundation, using color depth (Navy) rather than shadows to show its position in the hierarchy.

## Shapes

The design system uses a **Soft (0.25rem)** roundedness approach. This maintains a professional, systematic appearance that feels modern but not overly "bubbly" or consumer-grade.

- **Standard Elements:** Buttons, input fields, and small badges use `rounded` (4px).
- **Containers:** Large cards and the main profile header use `rounded-lg` (8px) to soften the large surface areas.
- **Avatars:** User photos should be consistently `rounded-lg` rather than circular to fit the architectural grid of the profile card.

## Components

### Sidebar Navigation
- **Default State:** Transparent background, white text at 70% opacity.
- **Active State:** Solid primary highlight or subtle background tint with 100% white text and a 3px left-accent border.

### Buttons
- **Primary:** Deep Navy background, white text, 4px corner radius.
- **Secondary/Outline:** 1px border of `#E2E8F0`, Navy or Blue text.
- **Ghost/Tertiary:** No border or background unless hovered. Used for "More" actions.

### Status Badges
- **Active:** Green background (`#DCFCE7`), Green text (`#166534`), uppercase 12px bold.
- **Inactive/Disabled:** Light gray background, dark gray text.

### Data Cards
- White background, 1px `#E2E8F0` border, 8px corner radius. 
- Content inside should be organized into logical groups with `title-sm` headings.

### Data Tables
- Header: Light gray background (`#F1F5F9`), `label-bold` text.
- Rows: 48px minimum height, 1px bottom border, hover state with a very light blue tint.

### Input Fields
- 1px border (`#CBD5E1`), 4px radius. 
- On focus: Border changes to Primary Blue (`#2563EB`) with a soft 2px outer glow.