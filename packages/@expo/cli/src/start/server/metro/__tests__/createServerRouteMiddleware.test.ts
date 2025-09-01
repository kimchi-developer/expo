import { validateMiddlewareMatcher } from '../router';

describe(validateMiddlewareMatcher, () => {
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  afterEach(async () => {
    jest.clearAllMocks();
  });

  describe('methods', () => {
    it('logs if methods is not an array', () => {
      const matcher = {
        methods: {},
      };
      validateMiddlewareMatcher(matcher);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Middleware matcher methods must be an array of valid HTTP methods.'
        )
      );
    });

    it('logs for invalid methods', () => {
      const matcher = {
        methods: ['GET', 'INVALID', 'POST'],
      };
      validateMiddlewareMatcher(matcher);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid middleware HTTP method: INVALID.')
      );
    });
  });

  describe('patterns', () => {
    it('logs if patterns are not a string or regex', () => {
      const matcher = {
        patterns: [1, null, undefined, {}, []],
      };
      validateMiddlewareMatcher(matcher);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(5);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Middleware matcher patterns must be strings or regular expressions.'
        )
      );
    });
  });
});
