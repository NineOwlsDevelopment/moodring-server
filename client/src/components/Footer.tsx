import { Link } from "react-router-dom";
import { GradientDivider } from "@/components/brand";
import logo from "../../public/icon.png";

/**
 * Footer Component
 *
 * Minimal, grid-aligned design following the Moodring brand identity:
 * - 4-column grid layout
 * - Sparse, calm typography
 * - Neon gradient divider line
 * - Deep graphite background
 */
export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative bg-graphite-deep mt-auto">
      {/* Gradient divider at top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-iris/50 to-transparent" />
      <GradientDivider className="opacity-50" />

      <div className="section-container py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 lg:gap-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <Link to="/" className="inline-flex items-center gap-2.5 mb-5">
              <img src={logo} alt="Moodring" className="w-9 h-9" />
              <span className="text-xl font-bold text-white">Moodring</span>
            </Link>
            <p className="text-moon-grey text-sm leading-relaxed max-w-xs mb-6">
              Solana-native prediction infrastructure with calm precision. Trade
              on future events with deep liquidity.
            </p>

            {/* Social Links */}
            <div className="flex items-center gap-3">
              <SocialLink
                href="https://twitter.com/moodringapp"
                label="Twitter"
                icon={<TwitterIcon />}
              />
              <SocialLink
                href="https://discord.gg/moodring"
                label="Discord"
                icon={<DiscordIcon />}
              />
              <SocialLink
                href="https://t.me/moodringapp"
                label="Telegram"
                icon={<TelegramIcon />}
              />
            </div>
          </div>

          {/* Markets Column */}
          <div>
            <h3 className="font-semibold text-white mb-5 text-sm uppercase tracking-wider">
              Markets
            </h3>
            <ul className="space-y-3">
              <FooterLink to="/markets?category=politics">Politics</FooterLink>
              <FooterLink to="/markets?category=crypto">Crypto</FooterLink>
              <FooterLink to="/markets?category=sports">Sports</FooterLink>
              <FooterLink to="/markets?category=economics">
                Economics
              </FooterLink>
              <FooterLink to="/markets?category=entertainment">
                Entertainment
              </FooterLink>
            </ul>
          </div>

          {/* Product Column */}
          <div>
            <h3 className="font-semibold text-white mb-5 text-sm uppercase tracking-wider">
              Product
            </h3>
            <ul className="space-y-3">
              <FooterLink to="/markets">All Markets</FooterLink>
              <FooterLink to="/leaderboard">Leaderboard</FooterLink>
              <FooterLink to="/create">Create Market</FooterLink>
              <FooterLink to="/#how-it-works">How it Works</FooterLink>
            </ul>
          </div>

          {/* Resources Column */}
          <div>
            <h3 className="font-semibold text-white mb-5 text-sm uppercase tracking-wider">
              Resources
            </h3>
            <ul className="space-y-3">
              <FooterLink href="#">Documentation</FooterLink>
              <FooterLink href="#">API Reference</FooterLink>
              <FooterLink href="#">SDK</FooterLink>
              <FooterLink href="#">Brand Kit</FooterLink>
              <FooterLink href="#">Status</FooterLink>
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h3 className="font-semibold text-white mb-5 text-sm uppercase tracking-wider">
              Legal
            </h3>
            <ul className="space-y-3">
              <FooterLink to="/terms">Terms of Service</FooterLink>
              <FooterLink to="/privacy">Privacy Policy</FooterLink>
              <FooterLink to="/cookies">Cookie Policy</FooterLink>
              <FooterLink to="/disclaimer">Disclaimer</FooterLink>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-white/[0.04]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-moon-grey-dark text-sm">
              © {currentYear} Moodring. All rights reserved.
            </p>

            {/* Built on Solana badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-graphite-light rounded-full">
              <span className="text-moon-grey-dark text-xs">Built on</span>
              <SolanaLogo />
              <span className="text-moon-grey text-xs font-medium">Solana</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

// ===== HELPER COMPONENTS =====

const FooterLink = ({
  to,
  href,
  children,
}: {
  to?: string;
  href?: string;
  children: React.ReactNode;
}) => {
  const classes =
    "text-moon-grey hover:text-white text-sm transition-colors duration-200 block";

  if (to) {
    return (
      <li>
        <Link to={to} className={classes}>
          {children}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
      >
        {children}
      </a>
    </li>
  );
};

const SocialLink = ({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={label}
    className="w-10 h-10 rounded-xl bg-graphite-light flex items-center justify-center text-moon-grey hover:text-white hover:bg-graphite-hover transition-all duration-200"
  >
    {icon}
  </a>
);

// ===== ICONS =====

const TwitterIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const DiscordIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const TelegramIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.46-1.9-.903-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.324-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.12.098.153.229.168.326.015.093.034.305.019.471z" />
  </svg>
);

const SolanaLogo = () => (
  <svg
    className="w-4 h-4 text-moon-grey"
    viewBox="0 0 128 128"
    fill="currentColor"
  >
    <path d="M93.95 42.18l-20.4 64.94c-.6 1.91-3.27 1.93-3.89.03L51.72 53.93a2 2 0 00-1.36-1.28L4.72 38.43c-1.97-.57-1.96-3.33.01-3.9l88.17-25.39c1.85-.53 3.58 1.19 3.05 3.04z" />
  </svg>
);
