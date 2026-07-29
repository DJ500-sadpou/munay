# Graph Report - .  (2026-07-28)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 910 nodes · 1982 edges · 113 communities (43 shown, 70 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.6)
- Token cost: 2,792 input · 1,305 output

## Community Hubs (Navigation)
- Admin and Order Pages
- Product Catalog and Details
- Basic UI Components
- Sheet and Sidebar Components
- Root Layout and Global UI
- Project Dependencies and Config
- Graph Generation Scripts
- TypeScript Configuration
- Admin Management Pages
- Chart Components
- Alert Dialog Components
- Order and Payment Logic
- Command and Dialog Components
- Form and Popover Components
- Admin API Routes
- User and Dropdown Menus
- Shadcn UI Configuration
- User and Auth API
- External Library Dependencies
- Context Menu Components
- User Account Pages
- Carousel Components
- Drawer Components
- Form UI Components
- Navigation Menu Components
- Order Validation and Security
- Email Notification Service
- Breadcrumb Components
- Project Documentation
- Toggle UI Components
- Turnstile Security Widget
- Alert UI Components
- ESLint Configuration
- Payment Infrastructure Docs
- Admin Login Page
- User Login Page
- Agent Documentation
- Style Variance Utility
- Clerk Auth Library
- Classname Utility
- Date Utility Library
- Drag and Drop Core
- Sortable List Library
- Carousel Engine
- Animation Library
- Form Validation Resolvers
- OTP Input Component
- Icon Library
- Neon Database Client
- Next.js Framework
- NextAuth Library
- Next.js Configuration
- Email Transport Library
- Brevo Email Transport
- Radix Accordion Primitive
- Radix Alert Dialog Primitive
- Radix Aspect Ratio Primitive
- Radix Avatar Primitive
- Radix Checkbox Primitive
- Radix Collapsible Primitive
- Radix Context Menu Primitive
- Radix Dialog Primitive
- Radix Dropdown Primitive
- Radix Hover Card Primitive
- Radix Label Primitive
- Radix Menubar Primitive
- Radix Navigation Primitive
- Radix Popover Primitive
- Radix Progress Primitive
- Radix Radio Group Primitive
- Radix Scroll Area Primitive
- Radix Select Primitive
- Radix Separator Primitive
- Radix Slider Primitive
- Radix Slot Primitive
- Radix Switch Primitive
- Radix Toggle Primitive
- Radix Toggle Group Primitive
- Radix Tooltip Primitive
- Date Picker Library
- React DOM Library
- React Form Library
- Markdown Rendering Library
- Resizable Panel Library
- React Hooks Library
- Data Visualization Library
- Image Processing Library
- Toast Notification Library
- Tailwind Merge Utility
- Tailwind Animation Plugin
- React Query Library
- React Table Library
- Nodemailer Type Definitions
- Drawer Primitive Library
- AI Web SDK
- Schema Validation Library
- PostCSS Configuration
- Middleware Configuration
- Tailwind CSS Config
- Vercel Deployment Config
- Project Architecture Graphs
- Catalog and Cart Development
- Payments and Orders Development
- User and Admin Development

## God Nodes (most connected - your core abstractions)
1. `cn()` - 226 edges
2. `isDbConfigured()` - 68 edges
3. `Button()` - 36 edges
4. `formatCents()` - 35 edges
5. `query()` - 34 edges
6. `Card()` - 25 edges
7. `CardContent()` - 25 edges
8. `queryOne()` - 22 edges
9. `Badge()` - 21 edges
10. `requireAdmin()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `CalendarDayButton()` --references--> `react`  [EXTRACTED]
  src/components/ui/calendar.tsx → package.json
- `Carousel()` --references--> `react`  [EXTRACTED]
  src/components/ui/carousel.tsx → package.json
- `useCarousel()` --references--> `react`  [EXTRACTED]
  src/components/ui/carousel.tsx → package.json
- `useFormField()` --references--> `react`  [EXTRACTED]
  src/components/ui/form.tsx → package.json
- `useSidebar()` --references--> `react`  [EXTRACTED]
  src/components/ui/sidebar.tsx → package.json

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Munay Technology Stack** — neon_postgres, clerk_auth, brevo_emails, kushki_gateway [EXTRACTED 0.95]
- **Munay Project Implementation Phases** — docs_phase1_md, docs_phase2_md, docs_phase3_md, docs_phase4_md, docs_phase5_md [EXTRACTED 1.00]

## Communities (113 total, 70 thin omitted)

### Community 0 - "Admin and Order Pages"
Cohesion: 0.06
Nodes (72): metadata, metadata, PageProps, metadata, AdminHomePage(), metadata, CarritoPage(), metadata (+64 more)

### Community 1 - "Product Catalog and Details"
Cohesion: 0.10
Nodes (40): CatalogoPage(), metadata, PageProps, FlashPage(), metadata, PageProps, CONDITION_LABEL, generateMetadata() (+32 more)

### Community 2 - "Basic UI Components"
Cohesion: 0.07
Nodes (35): AccordionContent(), AccordionItem(), AccordionTrigger(), Avatar(), AvatarFallback(), AvatarImage(), CardAction(), Menubar() (+27 more)

### Community 3 - "Sheet and Sidebar Components"
Cohesion: 0.06
Nodes (38): Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle(), SheetTrigger() (+30 more)

### Community 4 - "Root Layout and Global UI"
Cohesion: 0.09
Nodes (29): displaySerif, geistMono, geistSans, metadata, Footer(), Toast, ToastAction, ToastActionElement (+21 more)

### Community 5 - "Project Dependencies and Config"
Cohesion: 0.06
Nodes (33): bun-types, eslint, eslint-config-next, description, devDependencies, bun-types, eslint, eslint-config-next (+25 more)

### Community 6 - "Graph Generation Scripts"
Cohesion: 0.06
Nodes (20): depDot, depGraph, { files, imports }, fs, gv, html, HTML_OUTPUT, htmlData (+12 more)

### Community 7 - "TypeScript Configuration"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+20 more)

### Community 8 - "Admin Management Pages"
Cohesion: 0.13
Nodes (21): EditFlashCodePage(), metadata, PageProps, metadata, NewFlashCodePage(), AdminFlashCodesPage(), AdminMetricsPage(), metadata (+13 more)

### Community 9 - "Chart Components"
Cohesion: 0.10
Nodes (19): react, react, ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent() (+11 more)

### Community 10 - "Alert Dialog Components"
Cohesion: 0.10
Nodes (18): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogTitle() (+10 more)

### Community 11 - "Order and Payment Logic"
Cohesion: 0.18
Nodes (19): POST(), GET(), POST(), CreateOrderInput, CreateOrderItemInput, CreateOrderResult, markOrderCancelled(), markOrderPaid() (+11 more)

### Community 12 - "Command and Dialog Components"
Cohesion: 0.12
Nodes (15): Command(), CommandDialog(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator(), CommandShortcut() (+7 more)

### Community 13 - "Form and Popover Components"
Cohesion: 0.10
Nodes (7): Checkbox(), HoverCardContent(), PopoverContent(), Progress(), ResizableHandle(), ResizablePanelGroup(), Textarea()

### Community 14 - "Admin API Routes"
Cohesion: 0.25
Nodes (14): checkAdmin(), DELETE(), PUT(), RouteContext, checkAdmin(), GET(), POST(), checkAdmin() (+6 more)

### Community 15 - "User and Dropdown Menus"
Cohesion: 0.14
Nodes (13): UserInfo, UserMenu(), DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem() (+5 more)

### Community 16 - "Shadcn UI Configuration"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 17 - "User and Auth API"
Cohesion: 0.20
Nodes (11): checkAdmin(), DELETE(), PUT(), RouteContext, GET(), CurrentUser, getCurrentUser(), getSql() (+3 more)

### Community 18 - "External Library Dependencies"
Cohesion: 0.13
Nodes (16): cmdk, @dnd-kit/utilities, @mdxeditor/editor, dependencies, cmdk, @dnd-kit/utilities, @mdxeditor/editor, @radix-ui/react-tabs (+8 more)

### Community 19 - "Context Menu Components"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+1 more)

### Community 20 - "User Account Pages"
Cohesion: 0.23
Nodes (10): GET(), MyOrderDetailPage(), MyOrdersPage(), CuentaHomePage(), MyPointsPage(), sitemap(), CurrentUser, getOptionalUser() (+2 more)

### Community 21 - "Carousel Components"
Cohesion: 0.20
Nodes (13): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+5 more)

### Community 22 - "Drawer Components"
Cohesion: 0.18
Nodes (6): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 23 - "Form UI Components"
Cohesion: 0.25
Nodes (9): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItemContext, FormItemContextValue, FormLabel(), FormMessage() (+1 more)

### Community 24 - "Navigation Menu Components"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 25 - "Order Validation and Security"
Cohesion: 0.39
Nodes (6): POST(), POST(), requireTurnstile(), TurnstileVerifyResult, verifyTurnstileToken(), createOrder()

### Community 26 - "Email Notification Service"
Cohesion: 0.47
Nodes (7): escapeHtml(), getTransporter(), OrderConfirmationEmailData, RefundEmailData, sendEmail(), sendOrderConfirmationEmail(), sendRefundEmail()

### Community 27 - "Breadcrumb Components"
Cohesion: 0.25
Nodes (6): BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage(), BreadcrumbSeparator()

### Community 28 - "Project Documentation"
Cohesion: 0.38
Nodes (6): Brevo Emails, Clerk Auth, Guía de despliegue — Munay v0.1, Migración: Supabase+Resend → Neon+Brevo+Clerk+UploadThing, FASE 5/5 — Endurecimiento + Producción (FINAL), Neon Postgres

### Community 29 - "Toggle UI Components"
Cohesion: 0.43
Nodes (5): ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 30 - "Turnstile Security Widget"
Cohesion: 0.40
Nodes (5): detectInitialMode(), Props, TurnstileWidget(), WidgetStatus, Window

### Community 31 - "Alert UI Components"
Cohesion: 0.50
Nodes (4): Alert(), AlertDescription(), AlertTitle(), alertVariants

### Community 32 - "ESLint Configuration"
Cohesion: 0.50
Nodes (3): __dirname, eslintConfig, __filename

### Community 34 - "Payment Infrastructure Docs"
Cohesion: 0.67
Nodes (3): Pasarelas de pago para Ecuador (Ibarra), FASE 1/5 — Preparación de infraestructura + base de datos, Kushki Payment Gateway

## Knowledge Gaps
- **260 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+255 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **70 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Basic UI Components` to `Admin and Order Pages`, `Sheet and Sidebar Components`, `Root Layout and Global UI`, `Chart Components`, `Alert Dialog Components`, `Command and Dialog Components`, `Form and Popover Components`, `User and Dropdown Menus`, `Context Menu Components`, `Carousel Components`, `Drawer Components`, `Form UI Components`, `Navigation Menu Components`, `Breadcrumb Components`, `Toggle UI Components`, `Alert UI Components`?**
  _High betweenness centrality (0.426) - this node is a cross-community bridge._
- **Why does `dependencies` connect `External Library Dependencies` to `Project Dependencies and Config`, `Chart Components`, `Style Variance Utility`, `Clerk Auth Library`, `Classname Utility`, `Date Utility Library`, `Drag and Drop Core`, `Sortable List Library`, `Carousel Engine`, `Animation Library`, `Form Validation Resolvers`, `OTP Input Component`, `Icon Library`, `Neon Database Client`, `Next.js Framework`, `NextAuth Library`, `Email Transport Library`, `Brevo Email Transport`, `Radix Accordion Primitive`, `Radix Alert Dialog Primitive`, `Radix Aspect Ratio Primitive`, `Radix Avatar Primitive`, `Radix Checkbox Primitive`, `Radix Collapsible Primitive`, `Radix Context Menu Primitive`, `Radix Dialog Primitive`, `Radix Dropdown Primitive`, `Radix Hover Card Primitive`, `Radix Label Primitive`, `Radix Menubar Primitive`, `Radix Navigation Primitive`, `Radix Popover Primitive`, `Radix Progress Primitive`, `Radix Radio Group Primitive`, `Radix Scroll Area Primitive`, `Radix Select Primitive`, `Radix Separator Primitive`, `Radix Slider Primitive`, `Radix Slot Primitive`, `Radix Switch Primitive`, `Radix Toggle Primitive`, `Radix Toggle Group Primitive`, `Radix Tooltip Primitive`, `Date Picker Library`, `React DOM Library`, `React Form Library`, `Markdown Rendering Library`, `Resizable Panel Library`, `React Hooks Library`, `Data Visualization Library`, `Image Processing Library`, `Toast Notification Library`, `Tailwind Merge Utility`, `Tailwind Animation Plugin`, `React Query Library`, `React Table Library`, `Nodemailer Type Definitions`, `Drawer Primitive Library`, `AI Web SDK`, `Schema Validation Library`?**
  _High betweenness centrality (0.273) - this node is a cross-community bridge._
- **Why does `react` connect `Chart Components` to `Sheet and Sidebar Components`, `Root Layout and Global UI`, `Alert Dialog Components`, `External Library Dependencies`, `Carousel Components`, `Form UI Components`, `Toggle UI Components`?**
  _High betweenness centrality (0.246) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _260 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin and Order Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.059803921568627454 - nodes in this community are weakly interconnected._
- **Should `Product Catalog and Details` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `Basic UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.07092198581560284 - nodes in this community are weakly interconnected._