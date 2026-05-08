"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  description?: string;
  icon?: React.ReactNode;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

interface MegaMenuDef {
  columns: NavGroup[];
  footer?: { label: string; href: string }[];
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const SymtextMark = () => (
  <svg
    aria-hidden="true"
    height="22"
    viewBox="0 0 28 28"
    fill="currentColor"
  >
    <path d="M14 2.5L26 24H2L14 2.5z" />
  </svg>
);

const ChevronDown = ({ className = "" }: { className?: string }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M2.5 4.5L6 8L9.5 4.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Small icon blocks ─────────────────────────────────────────────────────────

const IconWrapper = ({ children }: { children: React.ReactNode }) => (
  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
    {children}
  </span>
);

const IconPreviews = () => (
  <IconWrapper>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" opacity=".5" />
      <rect x="1" y="9" width="6" height="6" rx="1" opacity=".3" />
      <rect x="9" y="9" width="6" height="6" rx="1" opacity=".7" />
    </svg>
  </IconWrapper>
);

const IconAI = () => (
  <IconWrapper>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z" />
    </svg>
  </IconWrapper>
);

const IconRendering = () => (
  <IconWrapper>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 8h6M8 5v6" strokeWidth="1.5" stroke="currentColor" />
    </svg>
  </IconWrapper>
);

const IconObservability = () => (
  <IconWrapper>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <polyline points="1,12 4,8 7,10 10,5 15,5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  </IconWrapper>
);

const IconSecurity = () => (
  <IconWrapper>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1L2 4v5c0 3 2.5 5.5 6 6 3.5-.5 6-3 6-6V4L8 1z" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  </IconWrapper>
);

const IconNextjs = () => (
  <IconWrapper>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="M5.5 5v6M5.5 5l5 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  </IconWrapper>
);

const IconTurborepo = () => (
  <IconWrapper>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.5" fill="currentColor" />
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
    </svg>
  </IconWrapper>
);

const IconAISDK = () => (
  <IconWrapper>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="2" width="5" height="5" rx="1" opacity=".6" />
      <rect x="9" y="2" width="5" height="5" rx="1" opacity=".9" />
      <rect x="2" y="9" width="5" height="5" rx="1" opacity=".9" />
      <rect x="9" y="9" width="5" height="5" rx="1" opacity=".6" />
    </svg>
  </IconWrapper>
);

const IconAIApps = () => (
  <IconWrapper>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3 8a5 5 0 0110 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  </IconWrapper>
);

const IconCommerce = () => (
  <IconWrapper>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="5" width="12" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 5V4a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  </IconWrapper>
);

const IconWebApps = () => (
  <IconWrapper>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="2" width="14" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1 6h14" stroke="currentColor" strokeWidth="1" />
      <circle cx="3.5" cy="4" r=".75" />
      <circle cx="5.75" cy="4" r=".75" />
    </svg>
  </IconWrapper>
);

const IconWorkflow = () => (
  <IconWrapper>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="4" width="4" height="3" rx="1" />
      <rect x="6" y="4" width="4" height="3" rx="1" />
      <rect x="11" y="4" width="4" height="3" rx="1" />
      <rect x="3.5" y="9" width="4" height="3" rx="1" />
      <rect x="8.5" y="9" width="4" height="3" rx="1" />
    </svg>
  </IconWrapper>
);

// ─── Mega Menu Data ───────────────────────────────────────────────────────────

const PRODUCTS_MENU: MegaMenuDef = {
  columns: [
    {
      heading: "DX Platform",
      items: [
        {
          label: "Previews",
          href: "/products/previews",
          description: "Helping teams ship 6× faster",
          icon: <IconPreviews />,
        },
        {
          label: "AI",
          href: "/products/ai",
          description: "Powering breakthroughs",
          icon: <IconAI />,
        },
      ],
    },
    {
      heading: "Managed Infrastructure",
      items: [
        {
          label: "Rendering",
          href: "/products/rendering",
          description: "Fast, scalable, and reliable",
          icon: <IconRendering />,
        },
        {
          label: "Observability",
          href: "/products/observability",
          description: "Trace every step",
          icon: <IconObservability />,
        },
        {
          label: "Security",
          href: "/products/security",
          description: "Scale without compromising",
          icon: <IconSecurity />,
        },
      ],
    },
    {
      heading: "Open Source",
      items: [
        {
          label: "Next.js",
          href: "https://nextjs.org",
          description: "The native Next.js platform",
          icon: <IconNextjs />,
        },
        {
          label: "Turborepo",
          href: "https://turbo.build/repo",
          description: "Speed with Enterprise scale",
          icon: <IconTurborepo />,
        },
        {
          label: "AI SDK",
          href: "https://sdk.vercel.ai",
          description: "The AI Toolkit for TypeScript",
          icon: <IconAISDK />,
        },
      ],
    },
  ],
};

const SOLUTIONS_MENU: MegaMenuDef = {
  columns: [
    {
      heading: "Use Cases",
      items: [
        {
          label: "AI Apps",
          href: "/solutions/ai-apps",
          description: "Deploy at the speed of AI",
          icon: <IconAIApps />,
        },
        {
          label: "Web Apps",
          href: "/solutions/web-apps",
          description: "Ship beautiful interfaces",
          icon: <IconWebApps />,
        },
        {
          label: "Workflow",
          href: "/solutions/workflow",
          description: "Streamlined development process",
          icon: <IconWorkflow />,
        },
      ],
    },
  ],
  footer: [
    { label: "Customer Stories", href: "/customers" },
    { label: "Enterprise", href: "/enterprise" },
  ],
};

const RESOURCES_MENU: MegaMenuDef = {
  columns: [
    {
      heading: "Resource Center",
      items: [
        {
          label: "Composable Commerce",
          href: "/resources/composable-commerce",
          description: "Migrations, strategies, global growth",
          icon: <IconCommerce />,
        },
        {
          label: "AI",
          href: "/resources/ai",
          description: "How to add AI features, benchmarks, SDKs",
          icon: <IconAI />,
        },
        {
          label: "Workflow",
          href: "/resources/workflow",
          description: "Improving DevX and iteration speed",
          icon: <IconWorkflow />,
        }
      ],
    },
  ],
  footer: [
    { label: "Blog", href: "/blog" },
    { label: "Changelog", href: "/changelog" },
    { label: "Docs", href: "/docs" },
  ],
};

// ─── Top-level nav config ─────────────────────────────────────────────────────

const NAV_LINKS: {
  label: string;
  href?: string;
  menu?: MegaMenuDef;
  menuAlign?: "start" | "center";
}[] = [
  { label: "Products", menu: PRODUCTS_MENU, menuAlign: "start" },
  { label: "Solutions", menu: SOLUTIONS_MENU },
  { label: "Resources", menu: RESOURCES_MENU },
  { label: "Templates", href: "/templates" },
  { label: "Enterprise", href: "/enterprise" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
];

// ─── Mega Menu Panel ──────────────────────────────────────────────────────────

function MegaMenuPanel({
  menu,
  align = "center",
}: {
  menu: MegaMenuDef;
  align?: "start" | "center";
}) {
  const totalColumns = menu.columns.length;

  return (
    <div
      className={`absolute top-full z-50 mt-2.5 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl ring-1 ring-black/5 dark:border-neutral-800 dark:bg-neutral-950 dark:ring-white/10
        ${align === "start" ? "left-0 translate-x-0" : "left-1/2 -translate-x-1/2"}
        ${totalColumns === 1 ? "w-72" : totalColumns === 2 ? "w-[540px]" : "w-[760px]"}`}
    >
      <div
        className={`grid gap-x-8 p-5.5 ${
          totalColumns === 1
            ? "grid-cols-1"
            : totalColumns === 2
            ? "grid-cols-2"
            : "grid-cols-3"
        }`}
      >
        {menu.columns.map((col) => (
          <div key={col.heading}>
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500">
              {col.heading}
            </p>
            <ul className="space-y-0.5">
              {col.items.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    prefetch={false}
                    className="group flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  >
                    {item.icon}
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-neutral-900 group-hover:text-black dark:text-neutral-100 dark:group-hover:text-white">
                        {item.label}
                      </span>
                      {item.description && (
                        <span className="block text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                          {item.description}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {menu.footer && menu.footer.length > 0 && (
        <div className="flex items-center gap-5 border-t border-neutral-100 px-5.5 py-3 dark:border-neutral-800">
          {menu.footer.map((f) => (
            <Link
              key={f.label}
              href={f.href}
              className="text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              {f.label} →
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mobile Menu ─────────────────────────────────────────────────────────────

function MobileMenu({ isOpen }: { isOpen: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 md:hidden">
      <nav className="px-4 py-4">
        {NAV_LINKS.map((link) => (
          <div key={link.label}>
            {link.menu ? (
              <>
                <button
                  onClick={() =>
                    setExpanded(expanded === link.label ? null : link.label)
                  }
                  className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-900"
                >
                  {link.label}
                  <ChevronDown
                    className={`transition-transform ${
                      expanded === link.label ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {expanded === link.label && (
                  <div className="mb-2 ml-4 space-y-3 border-l border-neutral-100 py-2 pl-4 dark:border-neutral-800">
                    {link.menu.columns.map((col) => (
                      <div key={col.heading}>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                          {col.heading}
                        </p>
                        {col.items.map((item) => (
                          <Link
                            key={item.label}
                            href={item.href}
                            prefetch={false}
                            className="block rounded px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-900"
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Link
                href={link.href!}
                prefetch={false}
                className="block rounded-md px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-900"
              >
                {link.label}
              </Link>
            )}
          </div>
        ))}

        <div className="mt-4 flex flex-col gap-2 border-t border-neutral-100 pt-4 dark:border-neutral-800">
          <Link
            href="/login"
            prefetch={false}
            className="rounded-full px-4 py-2 text-center text-sm font-medium text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50 dark:text-neutral-300 dark:ring-neutral-700 dark:hover:bg-neutral-900"
          >
            Log In
          </Link>
          <Link
            href="/register"
            prefetch={false}
            className="rounded-full bg-black px-4 py-2 text-center text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            Start Deploying
          </Link>
        </div>
      </nav>
    </div>
  );
}

// ─── Main Header ─────────────────────────────────────────────────────────────

export default function Header() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerRef = useRef<HTMLElement>(null);

  const openMenu = useCallback((label: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveMenu(label);
  }, []);

  const closeMenu = useCallback(() => {
    timeoutRef.current = setTimeout(() => setActiveMenu(null), 140);
  }, []);

  const keepOpen = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  // Close mega menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActiveMenu(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 w-full border-b border-neutral-200 bg-white/90 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/90"
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-9">
        {/* Logo */}
        <Link
          href="/"
          prefetch={false}
          className="flex shrink-0 items-center gap-2.5 text-black transition-opacity hover:opacity-90 dark:text-white"
          aria-label="Symtext home"
        >
          <SymtextMark />
          <span className="text-[15px] font-semibold tracking-tight">Symtext</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 rounded-full border border-neutral-200/80 bg-neutral-50/60 p-1 dark:border-neutral-800 dark:bg-neutral-900/60 md:mx-4 md:flex lg:mx-6" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <div key={link.label} className="relative">
              {link.menu ? (
                <button
                  onMouseEnter={() => openMenu(link.label)}
                  onMouseLeave={closeMenu}
                  onFocus={() => openMenu(link.label)}
                  onBlur={closeMenu}
                  aria-expanded={activeMenu === link.label}
                  aria-haspopup="true"
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[13px] font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/70 dark:focus-visible:ring-neutral-500/70 lg:px-3 lg:text-sm
                    ${
                      activeMenu === link.label
                        ? "bg-white text-black shadow-sm dark:bg-neutral-800 dark:text-white"
                        : "text-neutral-600 hover:bg-white/80 hover:text-black dark:text-neutral-400 dark:hover:bg-neutral-800/80 dark:hover:text-white"
                    }`}
                >
                  {link.label}
                  <ChevronDown
                    className={`transition-transform duration-200 ${
                      activeMenu === link.label ? "rotate-180" : ""
                    }`}
                  />
                </button>
              ) : (
                <Link
                  href={link.href!}
                  prefetch={false}
                  className="rounded-full px-2.5 py-1.5 text-[13px] font-medium text-neutral-600 transition-all duration-150 ease-out hover:bg-white/80 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/70 dark:text-neutral-400 dark:hover:bg-neutral-800/80 dark:hover:text-white dark:focus-visible:ring-neutral-500/70 lg:px-3 lg:text-sm"
                >
                  {link.label}
                </Link>
              )}

              {/* Mega menu */}
              {link.menu && activeMenu === link.label && (
                <div
                  onMouseEnter={keepOpen}
                  onMouseLeave={closeMenu}
                  role="region"
                  aria-label={`${link.label} menu`}
                  className="animate-in fade-in-0 zoom-in-95 duration-150 ease-out"
                >
                  <MegaMenuPanel menu={link.menu} align={link.menuAlign} />
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Right side CTAs */}
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            prefetch={false}
            className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:text-black dark:text-neutral-400 dark:hover:text-white md:block"
          >
            Log In
          </Link>
          <Link
            href="/register"
            prefetch={false}
            className="hidden rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 md:block"
          >
            Start Deploying
          </Link>
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 md:hidden"
          >
            {mobileOpen ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <MobileMenu isOpen={mobileOpen} />
    </header>
  );
}