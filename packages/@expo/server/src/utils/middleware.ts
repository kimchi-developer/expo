import type { MiddlewareModule, MiddlewarePattern } from '../types';

/**
 * Determines whether middleware should run for a given request based on matcher configuration.
 */
export function shouldRunMiddleware(request: Request, middleware: MiddlewareModule): boolean {
  const matcher = middleware.unstable_settings?.matcher;

  // No matcher means middleware runs on all requests
  if (!matcher) {
    return true;
  }

  const url = new URL(request.url);
  const pathname = url.pathname;

  // Check HTTP methods, if specified
  if (matcher.methods) {
    if (matcher.methods.length === 0 || !matcher.methods.includes(request.method)) {
      return false;
    }
  }

  // Check path patterns, if specified
  if (matcher.patterns) {
    const patterns = Array.isArray(matcher.patterns) ? matcher.patterns : [matcher.patterns];
    if (patterns.length === 0) {
      return false;
    }
    return patterns.some((pattern) => matchesPattern(pathname, pattern));
  }

  // If neither methods nor patterns are specified, run middleware on all requests
  return true;
}

/**
 * Tests if a pathname matches a given pattern. The matching order is as follows:
 *
 * - Exact string
 * - Glob pattern (supports `*` and `**`)
 * - Regular expression
 */
function matchesPattern(pathname: string, pattern: MiddlewarePattern): boolean {
  if (typeof pattern === 'string') {
    // Try exact match first
    if (pattern === pathname) {
      return true;
    }

    // Otherwise check if it's a glob pattern
    if (pattern.includes('*')) {
      return globToRegex(pattern).test(pathname);
    }
  }

  if (pattern instanceof RegExp) {
    return pattern.test(pathname);
  }

  return false;
}

/**
 * Converts a simple glob pattern to a regular expression. Supports `*` and `**`.
 */
function globToRegex(pattern: string): RegExp {
  // Handle `/**` matching everything
  if (pattern === '/**') {
    return new RegExp('^/.*$');
  }

  // Split pattern into segments and filter out empty first segment
  const segments = pattern.slice(1).split('/');

  // Transform each segment
  const transformedSegments = segments.map((segment, index) => {
    const isFirst = index === 0;
    const isLast = index === segments.length - 1;

    if (segment === '**') {
      if (isFirst && isLast) {
        return '.*';
      } else if (isFirst) {
        return '.+';
      } else if (isLast) {
        return '(?:/.*)?';
      } else {
        return '(?:/.*)?';
      }
    }

    if (segment === '*') {
      return '/[^/]+';
    }

    if (segment.endsWith('**')) {
      const prefix = segment.slice(0, -2);
      return '/' + escapeRegex(prefix) + '[^/]*/?';
    }

    if (segment.includes('*')) {
      return '/' + segment.replace(/\*/g, '[^/]*/?');
    }

    return '/' + escapeRegex(segment);
  });

  let regexString = transformedSegments.join('');

  if (!regexString.startsWith('/')) {
    regexString = '/' + regexString;
  }

  return new RegExp(`^${regexString}$`);
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.+^${}()|[\]\\?]/g, '\\$&');
}
