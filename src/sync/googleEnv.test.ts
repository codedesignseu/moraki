import appJson from '../../app.json';

import { iosClientIdFromUrlScheme, readGoogleIosClientId } from './googleEnv';

const PLUGIN = '@react-native-google-signin/google-signin';

describe('the Google iOS client ID (P5-F9)', () => {
  it('turns the reversed URL scheme back into the client ID', () => {
    expect(iosClientIdFromUrlScheme('com.googleusercontent.apps.123-abc')).toBe(
      '123-abc.apps.googleusercontent.com',
    );
  });

  it('refuses anything that is not a Google client scheme', () => {
    expect(iosClientIdFromUrlScheme(undefined)).toBeUndefined();
    expect(iosClientIdFromUrlScheme('moraki')).toBeUndefined();
    expect(iosClientIdFromUrlScheme('com.googleusercontent.apps.')).toBeUndefined();
  });

  it('reads it from the google-signin plugin options', () => {
    expect(
      readGoogleIosClientId([
        'expo-router',
        [PLUGIN, { iosUrlScheme: 'com.googleusercontent.apps.42-x' }],
      ]),
    ).toBe('42-x.apps.googleusercontent.com');
    expect(readGoogleIosClientId(['expo-router'])).toBeUndefined();
    expect(readGoogleIosClientId(undefined)).toBeUndefined();
  });

  it('finds a real client ID in this app’s own app.json', () => {
    const id = readGoogleIosClientId(appJson.expo.plugins);
    expect(id).toMatch(/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/);
  });
});
