import type { MiddlewareModule, MiddlewareMatcher } from '../../types';
import { shouldRunMiddleware } from '../../utils/middleware';

const createMockRequest = (url: string, method = 'GET'): Request => {
  return new Request(url, { method });
};

const createMiddlewareModule = (matcher?: MiddlewareMatcher): MiddlewareModule => {
  return {
    default: async () => undefined,
    unstable_settings: {
      matcher: matcher!,
    },
  };
};

const createMiddlewareModuleWithoutMatcher = (): MiddlewareModule => {
  return {
    default: async () => undefined,
  };
};

describe(shouldRunMiddleware, () => {
  describe('no matcher', () => {
    it('should run middleware on all requests when no matcher configured', () => {
      const middlewareWithoutSettings = createMiddlewareModuleWithoutMatcher();
      expect(
        shouldRunMiddleware(createMockRequest('https://expo.dev/'), middlewareWithoutSettings)
      ).toBe(true);
      expect(
        shouldRunMiddleware(
          createMockRequest('https://expo.dev/api/test'),
          middlewareWithoutSettings
        )
      ).toBe(true);

      const middlewareWithEmptySettings = {
        default: async () => undefined,
        unstable_settings: {},
      } as MiddlewareModule;
      expect(
        shouldRunMiddleware(
          createMockRequest('https://expo.dev/admin'),
          middlewareWithEmptySettings
        )
      ).toBe(true);
    });
  });

  describe('method matching', () => {
    describe('exact method', () => {
      it('should match when request method is in allowed methods', () => {
        const getRequest = createMockRequest('https://expo.dev/', 'GET');
        const getMiddleware = createMiddlewareModule({ methods: ['GET'] });
        expect(shouldRunMiddleware(getRequest, getMiddleware)).toBe(true);

        const postRequest = createMockRequest('https://expo.dev/', 'POST');
        expect(shouldRunMiddleware(postRequest, getMiddleware)).toBe(false);
      });
    });

    describe('multiple methods', () => {
      it('should match any method in the allowed list', () => {
        const middleware = createMiddlewareModule({
          methods: ['GET', 'POST', 'PUT'],
        });

        expect(shouldRunMiddleware(createMockRequest('https://expo.dev/', 'GET'), middleware)).toBe(
          true
        );
        expect(
          shouldRunMiddleware(createMockRequest('https://expo.dev/', 'POST'), middleware)
        ).toBe(true);
        expect(shouldRunMiddleware(createMockRequest('https://expo.dev/', 'PUT'), middleware)).toBe(
          true
        );

        expect(
          shouldRunMiddleware(createMockRequest('https://expo.dev/', 'DELETE'), middleware)
        ).toBe(false);
      });

      it('should not run with empty methods array', () => {
        const request = createMockRequest('https://expo.dev/', 'GET');
        const middleware = createMiddlewareModule({ methods: [] });

        expect(shouldRunMiddleware(request, middleware)).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle lowercase method names', () => {
        const request = createMockRequest('https://expo.dev/api');
        const middleware = createMiddlewareModule({
          methods: ['get'],
          patterns: ['/api'],
        });
        expect(shouldRunMiddleware(request, middleware)).toBe(true);
      });
    });
  });

  describe('pattern matching', () => {
    describe('exact patterns', () => {
      it('should match exact path', () => {
        const request = createMockRequest('https://expo.dev/');
        const middleware = createMiddlewareModule({ patterns: ['/'] });

        expect(shouldRunMiddleware(request, middleware)).toBe(true);
      });

      it('should match exact API path', () => {
        const request = createMockRequest('https://expo.dev/api');
        const middleware = createMiddlewareModule({ patterns: ['/api'] });

        expect(shouldRunMiddleware(request, middleware)).toBe(true);
      });

      it('should not match different path', () => {
        const request = createMockRequest('https://expo.dev/admin');
        const middleware = createMiddlewareModule({ patterns: ['/api'] });

        expect(shouldRunMiddleware(request, middleware)).toBe(false);
      });

      it('should not match partial path', () => {
        const request = createMockRequest('https://expo.dev/api/users');
        const middleware = createMiddlewareModule({ patterns: ['/api'] });

        expect(shouldRunMiddleware(request, middleware)).toBe(false);
      });
    });

    describe('multiple patterns', () => {
      it('should match any pattern in the allowed list', () => {
        const middleware = createMiddlewareModule({
          patterns: ['/', '/api', '/admin'],
        });

        expect(shouldRunMiddleware(createMockRequest('https://expo.dev/'), middleware)).toBe(true);
        expect(shouldRunMiddleware(createMockRequest('https://expo.dev/api'), middleware)).toBe(
          true
        );
        expect(shouldRunMiddleware(createMockRequest('https://expo.dev/admin'), middleware)).toBe(
          true
        );

        expect(
          shouldRunMiddleware(createMockRequest('https://expo.dev/settings'), middleware)
        ).toBe(false);
      });

      it('should not run with empty patterns array', () => {
        const request = createMockRequest('https://expo.dev/');
        const middleware = createMiddlewareModule({ patterns: [] });

        expect(shouldRunMiddleware(request, middleware)).toBe(false);
      });
    });

    describe('wildcard patterns', () => {
      it.each([
        ['https://expo.dev/users/api', true],
        ['https://expo.dev/admin/api', true],
        ['https://expo.dev/v1/api', true],
        ['https://expo.dev/api', false],
        ['https://expo.dev/users/admin/api', false],
        ['https://expo.dev/a/b/api', false],
      ])('should match paths with a leading wildcard', (url, expected) => {
        const middleware = createMiddlewareModule({ patterns: ['/*/api'] });
        expect(shouldRunMiddleware(createMockRequest(url), middleware)).toBe(expected);
      });

      it.each([
        ['https://expo.dev/api/v1/users', true],
        ['https://expo.dev/api/v2/users', true],
        ['https://expo.dev/api/admin/users', true],
        ['https://expo.dev/api/users', false],
        ['https://expo.dev/api/v1/admin/users', false],
        ['https://expo.dev/api/a/b/users', false],
      ])('should match paths with an interior wildcard', (url, expected) => {
        const middleware = createMiddlewareModule({ patterns: ['/api/*/users'] });
        expect(shouldRunMiddleware(createMockRequest(url), middleware)).toBe(expected);
      });

      it.each([
        ['https://expo.dev/api/users', true],
        ['https://expo.dev/api', false],
        ['https://expo.dev/api/', false],
        ['https://expo.dev/api/v1/users', false],
        ['https://expo.dev/api/v1/admin/users', false],
      ])('should match paths with a trailing /*', (url, expected) => {
        const middleware = createMiddlewareModule({ patterns: ['/api/*'] });
        expect(shouldRunMiddleware(createMockRequest(url), middleware)).toBe(expected);
      });

      it.each([
        ['https://expo.dev/api', true],
        ['https://expo.dev/api/', true],
        ['https://expo.dev/api123', true],
        ['https://expo.dev/apitest', true],
        ['https://expo.dev/apis', true],
        ['https://expo.dev/api/users', false],
        ['https://expo.dev/api/v1/users', false],
        ['https://expo.dev/api/v1/admin/users', false],
      ])('should match paths with a trailing *', (url, expected) => {
        const middleware = createMiddlewareModule({ patterns: ['/api*'] });
        expect(shouldRunMiddleware(createMockRequest(url), middleware)).toBe(expected);
      });
    });

    describe('deep wildcard patterns', () => {
      it.each([
        ['https://expo.dev/', true],
        ['https://expo.dev/api/users/123/profile', true],
      ])('should match all paths with deep wildcard /**', (url, expected) => {
        const request = createMockRequest(url);
        const middleware = createMiddlewareModule({ patterns: ['/**'] });

        expect(shouldRunMiddleware(request, middleware)).toBe(expected);
      });

      it.each([
        ['https://expo.dev/api', false],
        ['https://expo.dev/api/', false],
        ['https://expo.dev/users/api', true],
        ['https://expo.dev/admin/api', true],
        ['https://expo.dev/v1/api', true],
        ['https://expo.dev/users/admin/api', true],
        ['https://expo.dev/a/b/api', true],
        ['https://expo.dev/a/b/c/d/api', true],
        ['https://expo.dev/api/settings', false],
        ['https://expo.dev/admin/api/data', false],
        ['https://expo.dev/apis', false],
        ['https://expo.dev/api123', false],
        ['https://expo.dev/apitest', false],
      ])('should match nested paths with a leading double wildcard', (url, expected) => {
        const middleware = createMiddlewareModule({ patterns: ['/**/api'] });
        expect(shouldRunMiddleware(createMockRequest(url), middleware)).toBe(expected);
      });

      it.each([
        ['https://expo.dev/api/users', true],
        ['https://expo.dev/api/v1/users', true],
        ['https://expo.dev/api/v1/admin/users', true],
        ['https://expo.dev/api/a/b/c/d/users', true],
        ['https://expo.dev/api/users/settings', false],
        ['https://expo.dev/api/v1/users/data', false],
      ])('should match nested paths with an interior double wildcard', (url, expected) => {
        const middleware = createMiddlewareModule({ patterns: ['/api/**/users'] });
        expect(shouldRunMiddleware(createMockRequest(url), middleware)).toBe(expected);
      });

      it.each([
        ['https://expo.dev/api/', true],
        ['https://expo.dev/api/users', true],
        ['https://expo.dev/api/v1/users', true],
        ['https://expo.dev/api/v1/admin/users', true],
        ['https://expo.dev/api/a/b/c/d/users', true],
        ['https://expo.dev/api/users/settings', true],
        ['https://expo.dev/api/v1/users/data', true],
        ['https://expo.dev/api', true],
        ['https://expo.dev/v1/api/users/data', false],
      ])(
        'should match nested paths with a trailing double wildcard with preceding /',
        (url, expected) => {
          const middleware = createMiddlewareModule({ patterns: ['/api/**'] });
          expect(shouldRunMiddleware(createMockRequest(url), middleware)).toBe(expected);
        }
      );

      it.each([
        ['https://expo.dev/api', true],
        ['https://expo.dev/api/', true],
        ['https://expo.dev/api123', true],
        ['https://expo.dev/apitest', true],
        ['https://expo.dev/apis', true],
        ['https://expo.dev/api/users', false],
        ['https://expo.dev/api/v1/users', false],
        ['https://expo.dev/api/v1/admin/users', false],
        ['https://expo.dev/api/a/b/c/d/users', false],
        ['https://expo.dev/api/users/settings', false],
        ['https://expo.dev/api/v1/users/data', false],
      ])(
        'should match string prefixes with a trailing double wildcard without preceding /',
        (url, expected) => {
          const middleware = createMiddlewareModule({ patterns: ['/api**'] });
          expect(shouldRunMiddleware(createMockRequest(url), middleware)).toBe(expected);
        }
      );
    });

    describe('complex wildcard patterns', () => {
      it.each([
        ['https://expo.dev/v1/api', true],
        ['https://expo.dev/v1/api/users', true],
        ['https://expo.dev/v1/api/users/123', true],
        ['https://expo.dev/admin/api/settings/global', true],
        ['https://expo.dev/api', false],
        ['https://expo.dev/a/b/api', false],
      ])('should handle a leading wildcard with a trailing double wildcard', (url, expected) => {
        const middleware = createMiddlewareModule({ patterns: ['/*/api/**'] });
        expect(shouldRunMiddleware(createMockRequest(url), middleware)).toBe(expected);
      });

      it.each([
        ['https://expo.dev/api/users', false],
        ['https://expo.dev/api/data', false],
        ['https://expo.dev/api/settings', false],
        ['https://expo.dev/admin/api/data', true],
        ['https://expo.dev/v1/api/users', true],
        ['https://expo.dev/admin/v1/api/users', true],
        ['https://expo.dev/api', false],
        ['https://expo.dev/api/', false],
        ['https://expo.dev/v1/api', false],
        ['https://expo.dev/api/users/123', false],
        ['https://expo.dev/api/v1/users', false],
      ])(
        'should handle a leading double wildcard with a trailing single wildcard',
        (url, expected) => {
          const middleware = createMiddlewareModule({ patterns: ['/**/api/*'] });
          expect(shouldRunMiddleware(createMockRequest(url), middleware)).toBe(expected);
        }
      );

      it.each([
        ['https://expo.dev/api/user/data', true],
        ['https://expo.dev/api/user/data/profile', true],
        ['https://expo.dev/api/admin/data/settings/global', true],
        ['https://expo.dev/api/data', false],
        ['https://expo.dev/api/user/admin/data', false],
        ['https://expo.dev/api/user/settings', false],
      ])('should handle complex pattern with multiple wildcards', (url, expected) => {
        const middleware = createMiddlewareModule({ patterns: ['/api/*/data/**'] });
        expect(shouldRunMiddleware(createMockRequest(url), middleware)).toBe(expected);
      });

      it.each([
        ['https://expo.dev/v1/api/admin/users', true],
        ['https://expo.dev/admin/api/v2/users', true],
        ['https://expo.dev/api/v1/users', false],
        ['https://expo.dev/v1/api/users', false],
        ['https://expo.dev/a/b/api/v1/users', false],
      ])('should handle multiple single wildcards', (url, expected) => {
        const middleware = createMiddlewareModule({ patterns: ['/*/api/*/users'] });
        expect(shouldRunMiddleware(createMockRequest(url), middleware)).toBe(expected);
      });
    });

    describe('regex patterns', () => {
      it('should handle regex pattern matching', () => {
        const simpleMiddleware = createMiddlewareModule({
          patterns: [/^\/api\/users$/],
        });
        expect(
          shouldRunMiddleware(createMockRequest('https://expo.dev/api/users'), simpleMiddleware)
        ).toBe(true);
        expect(
          shouldRunMiddleware(createMockRequest('https://expo.dev/admin/users'), simpleMiddleware)
        ).toBe(false);

        const complexMiddleware = createMiddlewareModule({
          patterns: [/^\/auth\/(login|logout)$/],
        });
        expect(
          shouldRunMiddleware(createMockRequest('https://expo.dev/auth/login'), complexMiddleware)
        ).toBe(true);
        expect(
          shouldRunMiddleware(createMockRequest('https://expo.dev/auth/logout'), complexMiddleware)
        ).toBe(true);
        expect(
          shouldRunMiddleware(
            createMockRequest('https://expo.dev/auth/register'),
            complexMiddleware
          )
        ).toBe(false);
      });
    });
  });

  describe('combined method and pattern matching', () => {
    it('should match when both method and pattern match', () => {
      const request = createMockRequest('https://expo.dev/api', 'POST');
      const middleware = createMiddlewareModule({
        methods: ['POST'],
        patterns: ['/api'],
      });

      expect(shouldRunMiddleware(request, middleware)).toBe(true);
    });

    it('should not match when method matches but pattern does not', () => {
      const request = createMockRequest('https://expo.dev/', 'POST');
      const middleware = createMiddlewareModule({
        methods: ['POST'],
        patterns: ['/api'],
      });

      expect(shouldRunMiddleware(request, middleware)).toBe(false);
    });

    it('should not match when pattern matches but method does not', () => {
      const request = createMockRequest('https://expo.dev/api', 'GET');
      const middleware = createMiddlewareModule({
        methods: ['POST'],
        patterns: ['/api'],
      });

      expect(shouldRunMiddleware(request, middleware)).toBe(false);
    });

    it('should handle multiple methods and patterns', () => {
      const request = createMockRequest('https://expo.dev/admin', 'PUT');
      const middleware = createMiddlewareModule({
        methods: ['POST', 'PUT', 'DELETE'],
        patterns: ['/api', '/admin', '/settings'],
      });

      expect(shouldRunMiddleware(request, middleware)).toBe(true);
    });

    it('should work with wildcards and multiple methods', () => {
      const request = createMockRequest('https://expo.dev/api/users', 'DELETE');
      const middleware = createMiddlewareModule({
        methods: ['POST', 'PUT', 'DELETE'],
        patterns: ['/api/*'],
      });

      expect(shouldRunMiddleware(request, middleware)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should run when only methods are specified', () => {
      const request = createMockRequest('https://expo.dev/any/path', 'POST');
      const middleware = createMiddlewareModule({
        methods: ['POST'],
      });

      expect(shouldRunMiddleware(request, middleware)).toBe(true);
    });

    it('should run when only patterns are specified', () => {
      const request = createMockRequest('https://expo.dev/api', 'GET');
      const middleware = createMiddlewareModule({
        patterns: ['/api'],
      });

      expect(shouldRunMiddleware(request, middleware)).toBe(true);
    });

    it('should run when neither methods nor patterns are specified but matcher exists', () => {
      const request = createMockRequest('https://expo.dev/api', 'GET');
      const middleware = createMiddlewareModule({});

      expect(shouldRunMiddleware(request, middleware)).toBe(true);
    });

    it('should handle query parameters in URL', () => {
      const request = createMockRequest('https://expo.dev/api?param=value', 'GET');
      const middleware = createMiddlewareModule({
        patterns: ['/api'],
      });

      expect(shouldRunMiddleware(request, middleware)).toBe(true);
    });

    it('should handle hash fragments in URL', () => {
      const request = createMockRequest('https://expo.dev/api#section', 'GET');
      const middleware = createMiddlewareModule({
        patterns: ['/api'],
      });

      expect(shouldRunMiddleware(request, middleware)).toBe(true);
    });

    it('should handle paths with trailing slash', () => {
      const request = createMockRequest('https://expo.dev/api/', 'GET');
      const middleware = createMiddlewareModule({
        patterns: ['/api/'],
      });

      expect(shouldRunMiddleware(request, middleware)).toBe(true);
    });

    it('should distinguish between paths with and without trailing slash', () => {
      const request = createMockRequest('https://expo.dev/api/', 'GET');
      const middleware = createMiddlewareModule({
        patterns: ['/api'],
      });

      expect(shouldRunMiddleware(request, middleware)).toBe(false);
    });
  });
});
