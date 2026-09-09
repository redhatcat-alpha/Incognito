import type { AnchorHTMLAttributes, ReactNode, Ref } from 'react';

/**
 * A plain anchor used by the browser bundle.
 *
 * vinext beta.5 currently emits a broken dynamic navigation module for
 * standalone production builds. Its <Link> prevents the browser default and
 * then fails before changing the URL, which makes every navigation link look
 * dead. A normal anchor keeps navigation reliable on the server deployment;
 * browser history and scroll restoration still work as expected after the
 * full document navigation.
 */
export type StaticLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  children?: ReactNode;
  prefetch?: boolean | null;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  locale?: string | false;
  passHref?: boolean;
  legacyBehavior?: boolean;
};

export default function StaticLink({
  href,
  children,
  prefetch: _prefetch,
  replace: _replace,
  scroll: _scroll,
  shallow: _shallow,
  locale: _locale,
  passHref: _passHref,
  legacyBehavior: _legacyBehavior,
  ...props
}: StaticLinkProps & { ref?: Ref<HTMLAnchorElement> }) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
