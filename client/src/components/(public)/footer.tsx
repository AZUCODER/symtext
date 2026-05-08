import Link from "next/link";
import { FooterStatusBar } from "@/components/(public)/footer-status-bar";

const links = [
  {
    title: "About",
    href: "/#about",
  },
  {
    title: "Contact",
    href: "/#contact",
  },
  {
    title: "Terms of Service",
    href: "/#terms",
  },
  {
    title: "Privacy Policy",
    href: "/#privacy",
  },
];

const socialLinks = [
  {
    label: "Google Plus",
    href: "/",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M23 11h-2V9h-2v2h-2v2h2v2h2v-2h2v-2zM8 11v2.4h3.97c-.16 1.03-1.2 3.02-3.97 3.02-2.39 0-4.34-1.98-4.34-4.42S5.61 7.58 8 7.58c1.36 0 2.27.58 2.79 1.08l1.9-1.83C11.47 5.69 9.89 5 8 5 4.13 5 1 8.13 1 12s3.13 7 7 7c4.04 0 6.72-2.84 6.72-6.84 0-.46-.05-.81-.11-1.16H8z" />
      </svg>
    ),
  },
  {
    label: "X",
    href: "/",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "WeChat",
    href: "/",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.295.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-3.898-6.348-7.601-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.148 1.72-1.46 1.259-2.334 3.179-1.82 5.43.09.41.303.992.698 1.507.081.104.071.01.071.01l-.013.278-.35 1.326a.285.285 0 0 0-.04.171.27.27 0 0 0 .27.27.294.294 0 0 0 .152-.049l1.741-1.018a.786.786 0 0 1 .655-.09 9.191 9.191 0 0 0 2.588.369c3.497 0 6.329-2.399 6.329-5.359.001-2.926-2.762-5.308-6.133-5.365zm-2.99 2.205c.586 0 1.061.483 1.061 1.078 0 .595-.475 1.078-1.061 1.078-.586 0-1.061-.483-1.061-1.078 0-.595.475-1.078 1.061-1.078zm5.952 0c.586 0 1.061.483 1.061 1.078 0 .595-.475 1.078-1.061 1.078-.586 0-1.061-.483-1.061-1.078 0-.595.475-1.078 1.061-1.078z" />
      </svg>
    ),
  },
];

const Footer = () => {
  return (
    <footer className="border-t bg-background px-6 pb-2 pt-2">
      <div className="mx-auto w-full max-w-screen-2xl divide-y">
        <div className="flex flex-col items-center justify-between gap-4 px-2 pt-3 pb-5 sm:flex-row">
          <Link className="flex items-center gap-2" href="/">
            <svg
              viewBox="0 0 28 28"
              className="h-6 w-6"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M14 2.5L26 24H2L14 2.5z" />
            </svg>
            <span className="font-medium text-xl">Symtext</span>
          </Link>

          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-medium text-sm">
            {links.map(({ title, href }) => (
              <li key={title}>
                <Link href={href}>{title}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <FooterStatusBar />
          <div className="flex flex-col-reverse items-center justify-between gap-4 px-2 pt-4 pb-2 sm:flex-row">
            <p className="font-medium text-muted-foreground text-sm text-center sm:flex-1">
              Copyright &copy; {new Date().getFullYear()} Symtext. All rights
              reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
