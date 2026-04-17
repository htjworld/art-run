# Design System Strategy: The Sketchbook Cartographer

## 1. Overview & Creative North Star
**Creative North Star: "The Curated Sketchbook"**
This design system moves away from the rigid, clinical nature of traditional fitness trackers. Instead, it treats the runner’s map as a canvas and the interface as a premium sketchbook. We bridge the gap between "technical tool" and "creative expression" by utilizing intentional white space, high-contrast "ink" typography, and layered surfaces that feel like stacked vellum paper. 

The goal is to make the act of route-planning feel as tactile and rewarding as drawing in a physical journal. We break the "template" look through **asymmetric layouts** (e.g., placing floating action buttons off-center) and **tonal depth** that prioritizes soft background shifts over harsh lines.

---

## 2. Colors & Surface Philosophy
The palette is rooted in a high-contrast "Ink on Paper" concept, softened by a breathable, airy secondary palette.

### Core Tokens
- **Primary (Accent):** `#346570` (Derived from `#BDEFFC` for accessibility)
- **Primary Container (The Path):** `#BDEFFC` (Used for active states and route highlights)
- **On-Surface (Ink):** `#0B1220` (Our deepest anchor for text and structural borders)
- **Background:** `#F9F9FF` (The base "canvas")
- **Surface Lowest (The Card):** `#FFFFFF` (Pure white for elevated elements)

### The "No-Line" Rule
Prohibit 1px solid borders for sectioning content. Boundaries must be defined through **Background Shifting**. 
- A `surface-container-low` section should sit on a `surface` background to create a "well" effect.
- Use the **Ghost Border** fallback: if a container needs definition against a white background, use the `outline-variant` (`#C0C8CA`) at **15% opacity** only.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of paper:
1. **The Map (Base):** The infinite canvas.
2. **The Sheet (Surface Container):** `#E9EDFF` — Large layout areas.
3. **The Card (Surface Lowest):** `#FFFFFF` — Floating interactive elements.

### Signature Texture: The Map Halo
To ensure the "Sketchbook" feel translates to the map, all route paths must utilize a **2px White Halo** (`#FFFFFF`) with the `primary-container` (`#BDEFFC`) core. This creates a "sticker" effect that lifts the user's art off the technical map tiles.

---

## 3. Typography
We use **Pretendard** and **Plus Jakarta Sans** to balance modern precision with friendly approachability.

*   **Display (Plus Jakarta Sans):** Used for "Artistic Wins" (e.g., total distance, route titles). It is bold, expressive, and evokes a premium editorial feel.
*   **Body/Labels (Manrope/Pretendard):** Used for technical data. Focus on high tracking (+2%) for smaller labels to maintain readability during movement.

**Hierarchy Strategy:** 
- **Display-LG (3.5rem):** For milestone numbers.
- **Title-LG (1.375rem):** For course names. 
- **Body-MD (0.875rem):** For navigation and instructions.

---

## 4. Elevation & Depth
In this design system, depth is a narrative tool. We use **Tonal Layering** to guide the eye.

### The Layering Principle
Instead of drop shadows for every card, use **Surface Nesting**:
- Place a `surface-container-lowest` card inside a `surface-container-high` drawer. The 2-tone shift creates a natural, soft-touch elevation.

### Ambient Shadows
When a floating action (like "Start Run") requires a shadow, use an **Extra-Diffused Bloom**:
- `box-shadow: 0 12px 32px rgba(11, 18, 32, 0.06);`
- The shadow color is a tinted version of our "Ink" color, never pure black.

### Glassmorphism
For map overlays and toolbars, use a **Backdrop Blur (12px)** combined with a semi-transparent `surface-container-lowest` (80% opacity). This ensures the map "soul" is never fully hidden, maintaining the sketchbook's transparency.

---

## 5. Components

### Buttons
- **Primary:** Background: `#BDEFFC` | Text: `#0B1220`. 
  - *Styling:* 8px radius (`sm`). Use a subtle `primary` (`#346570`) 1.5px bottom-border to give it a "pressed paper" look.
- **Secondary:** Background: Transparent | Border: 1.5px `#0B1220`.
  - *Styling:* High-contrast, tactile, and professional.

### Cards & Lists
- **Rule:** Absolute prohibition of divider lines. 
- **Separation:** Use **24px vertical white space** or a shift from `surface-container-low` to `surface-container-lowest`. 
- **Radius:** 12px (`md`) for standard cards; 16px (`xl`) for modal sheets.

### Input Fields
- **Drawing Mode:** When the user is "drawing" a route, the input container should shift to a `surface-container-highest` (`#DCE2F6`) to signal an active creative state.
- **Focus State:** 2px solid `#BDEFFC` outer glow.

### The "Ink" Iconography
- Use **Lucide-style outline icons**. 
- Stroke weight: 1.5px. 
- All icons must use the "Ink" color (`#0B1220`) to feel like hand-drawn annotations on the map.

---

## 6. Do’s and Don'ts

### Do:
- **Do** allow elements to overlap. A card can partially hang over a map legend to create depth.
- **Do** use asymmetric margins (e.g., 24px left, 32px right) for a "scrapbook" layout.
- **Do** use the `#BDEFFC` halo on map paths to maintain the brand’s signature visual hook.

### Don't:
- **Don't** use 100% opaque black borders. If you need a border, it must be the "Ink" color or a "Ghost Border" (15% opacity).
- **Don't** use standard Material Design "Drop Shadows." They are too heavy for this "Light & Playful" identity.
- **Don't** crowd the map. Use the "Surface Container Lowest" with a backdrop blur to keep the interface feeling like it’s floating over the world.