// Shared sign-out flow for all four role screens.
//
// Saved credentials deliberately survive a normal sign-out — that is the whole
// point of "remember me". The only thing that clears them is the explicit
// "Sign out & forget me" choice offered here, which is what a user hands the
// phone to someone else needs.

import {Alert} from 'react-native';
import auth from '@react-native-firebase/auth';
import {forgetCredentials, loadCredentials} from './credentials';

const goToLogin = async (navigation: any, forget: boolean) => {
  if (forget) await forgetCredentials();
  try {
    await auth().signOut();
  } catch (e) {
    console.log('❌ QUANTAIP Error:', e);
  }
  navigation.reset({index: 0, routes: [{name: 'Login'}]});
};

export const confirmSignOut = async (navigation: any) => {
  const saved = await loadCredentials();

  // Nothing stored — no point offering to forget it.
  if (!saved.id && !saved.pass) {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Sign Out', style: 'destructive', onPress: () => goToLogin(navigation, false)},
    ]);
    return;
  }

  Alert.alert(
    'Sign Out',
    `Your login (${saved.id}) is saved on this device so you don't have to type it again. Sign out and keep it, or forget it too?`,
    [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Sign Out', onPress: () => goToLogin(navigation, false)},
      {
        text: 'Sign Out & Forget Me',
        style: 'destructive',
        onPress: () => goToLogin(navigation, true),
      },
    ],
  );
};
