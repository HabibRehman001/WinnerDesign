# Winner Design

Local kitchen and bathroom CAD. The 3D view runs on Babylon.js. The floor plan and elevations stay on canvas. Projects, catalogues, quotes, and backups stay on this computer. Nothing in this app talks to Flex Cloud.

The list below follows the Winner Flex consolidated guide (31 October 2026) and records what is built so far.

## Integrated

### Room and model (guide sections 1 and 3)

- 2D floor plan, 3D view, elevation, split view, and walkthrough.
- Walls from typed sizes, with ceiling height and flat, shed, or gable roofs.
- Doors, windows, and niches cut through the wall mesh. Pillars, beams, chimneys, pipes, and dormers.
- Cabinets, appliances, and sanitaryware placed from the catalogue. Width, height, and depth rebuild the fronts instead of stretching one mesh.
- Each door has its own hinge: left, right, top, or bottom. A corner or carousel unit snaps to the nearest interior wall corner, and a 15–150 mm gap on either leg still gets a filler.
- Doors, flaps, and drawers open.
- Automatic worktops, plinths, cornice, pelmet, and splashback. A gap of 15–150 mm at the end of a run gets a filler.
- Snap on the plan. While a unit is dragged, the readout shows millimetres to the left and right wall ends. Arrow keys nudge 1 mm, Shift+arrows 10 mm.
- Overlap warning, with a red outline in 3D. Hob clearance, oven door swing against a return wall, and tall units under beams are flagged before the quote.
- Real-time render: sun direction, under-cabinet lights, shadows, ambient occlusion, and screen reflections. Gloss, matte, wood, shaker, and raised fronts. Wood grain and stone vein direction.
- Splashback tiles have their own size, grout, and angle, in the 3D view and on the elevation.
- Door and worktop colours accept a short RAL Classic set or an NCS code, as well as a hex colour.
- Split plan and 3D. Elevation of the selected wall. F5 focuses the catalogue, F2 opens room properties. Right-click changes with the object under the cursor.
- PNG stills from the 3D view, including the sizes used on quotations.

### Survey capture (guide section 2)

- Survey notes and attached photos or files, stored in the project.
- Room JSON export and import: walls, openings, fixtures, and ceiling height.
- Text IFC import limited to walls, doors, and windows. Other entities are counted and skipped.

### Quote, order, and job stages (guide sections 4 and 5)

- Live bill of materials and quotation PDF, including VAT, fitting, delivery-related lines already in the quote, price group, discount, and margin.
- Supplier-order PDF. Export stops when a product code is missing or a price is zero.
- Installer pack PDF: plan plus the item list.
- Local status for the ten stages from enquiry through install, with a history of who changed it.
- A locked revision blocks design edits until a manager opens the next revision.
- Customer comments stored on the project. View → Present shows the 3D model with those comments.

### Office, on one machine (guide sections 6, 7, and 8)

- Staff profiles: administrator, shop manager, designer, junior designer, sales assistant, and auditor.
- Juniors and sales do not see cost prices. A discount above 10% needs a manager.
- An audit log of sign-in, status changes, locks, and refused discounts.
- More than one local shop name, switched from the office panel.
- Lead source and budget on the project. Duplicate project.
- Documents tagged private or shop.
- Built-in catalogue, imported supplier JSON, and a shop catalogue for a custom unit. Price group, discount, and margin travel with the catalogue. A newer import of the same catalogue keeps the old version hidden. Applying that catalogue updates prices for matching codes and leaves drawn sizes unchanged. Codes that are no longer in the catalogue stay on the drawing and are listed.

### Recovery (guide section 9)

- A backup every 10 minutes and again on manual save. The latest two backups can be restored.
- Moving a project to trash, restoring it, or emptying the trash.

Open these from **File → Office, survey, recovery**.

## Not integrated

These stay out because they are cloud services, hardware this desktop app cannot run, or a full manufacturing back office.

- Flex Cloud: shared workspace, web dashboard, live refresh, drag-and-drop project board across staff, and privacy that is enforced on a server.
- Showcase 360 publishing, customer login, and live comment sync.
- Catalogue download and publish through Cyncly CMC, including administrator handover and version migration.
- Licence server, named-user licensing, and removal of dongles.
- REST API and ERP or accounting sync.
- Bluetooth laser rangefinders and Apple LiDAR / Cyncly Scan. Capture is typed sizes, room JSON, or a text IFC file.
- Winner MSA as a phone app. The installer PDF is the site pack.
- Email of orders. The order is a PDF you attach yourself.
- Roles do not stop someone who edits the `.winner` file by hand.

## Run

```bash
npm install
npm run dev
```

The dev server is http://localhost:5173/. `npm run desktop` opens the Electron shell after a build.
