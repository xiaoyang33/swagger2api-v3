import { stripMethodNamePrefixes } from '../src/utils';

describe('stripMethodNamePrefixes', () => {
  test('removes single prefix', () => {
    expect(stripMethodNamePrefixes('apiGetName', ['api'])).toBe('getName');
    expect(stripMethodNamePrefixes('authUserInfo', ['auth'])).toBe('userInfo');
  });

  test('removes multiple prefixes', () => {
    expect(stripMethodNamePrefixes('apiGetName', ['api', 'auth'])).toBe(
      'getName'
    );
    expect(stripMethodNamePrefixes('authUserInfo', ['api', 'auth'])).toBe(
      'userInfo'
    );
    expect(stripMethodNamePrefixes('apiAuthGetName', ['api', 'auth'])).toBe(
      'getName'
    );
  });

  test('handles case insensitive matching', () => {
    expect(stripMethodNamePrefixes('ApiGetName', ['api'])).toBe('getName');
    expect(stripMethodNamePrefixes('APIGetName', ['api'])).toBe('getName');
    expect(stripMethodNamePrefixes('authUserInfo', ['Auth'])).toBe('userInfo');
  });

  test('returns original name when no prefix matches', () => {
    expect(stripMethodNamePrefixes('getUserInfo', ['api', 'auth'])).toBe(
      'getUserInfo'
    );
    expect(stripMethodNamePrefixes('createPost', ['api'])).toBe('createPost');
  });

  test('handles empty or undefined prefix array', () => {
    expect(stripMethodNamePrefixes('apiGetName', [])).toBe('apiGetName');
    expect(stripMethodNamePrefixes('apiGetName', undefined)).toBe('apiGetName');
  });

  test('removes all matching prefixes iteratively', () => {
    expect(stripMethodNamePrefixes('apiApiGetName', ['api'])).toBe('getName');
    expect(stripMethodNamePrefixes('authApiAuthGetName', ['api', 'auth'])).toBe(
      'getName'
    );
  });

  test('preserves camelCase after prefix removal', () => {
    expect(stripMethodNamePrefixes('apiGetUserInfo', ['api'])).toBe(
      'getUserInfo'
    );
    expect(stripMethodNamePrefixes('authCreateNewPost', ['auth'])).toBe(
      'createNewPost'
    );
  });

  test('handles prefix that matches entire name', () => {
    expect(stripMethodNamePrefixes('api', ['api'])).toBe('api');
    expect(stripMethodNamePrefixes('auth', ['auth'])).toBe('auth');
  });
});
