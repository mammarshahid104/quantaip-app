import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {
  LockClosedIcon,
  LockOpenIcon,
  UserIcon,
  AcademicCapIcon,
  UsersIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  ExclamationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckIcon,
  TrashIcon,
} from 'react-native-heroicons/outline';
import {
  loadCredentials,
  saveCredentials,
  clearCredentials,
  forgetCredentials,
  hasAskedToRemember,
  markAskedToRemember,
} from './services/credentials';
import {useOtaUpdates} from './services/otaUpdates';
import AdminScreen from './screens/AdminScreen';
import TeacherScreen from './screens/TeacherScreen';
import StudentScreen from './screens/StudentScreen';
import ParentScreen from './screens/ParentScreen';
import {theme} from './theme';

const Stack = createNativeStackNavigator();

const detectRole = (userId: string): string | null => {
  const upper = userId.toUpperCase();
  if (upper.includes('-ADM-')) return 'admin';
  if (upper.includes('-TCH-')) return 'teacher';
  if (upper.includes('-STU-')) return 'student';
  if (upper.includes('-PAR-')) return 'parent';
  return null;
};

const formatId = (text: string): string => {
  const clean = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (clean.length <= 3) return clean;
  if (clean.length <= 6) return `${clean.slice(0,3)}-${clean.slice(3)}`;
  if (clean.length <= 9) return `${clean.slice(0,3)}-${clean.slice(3,6)}-${clean.slice(6)}`;
  const role = clean.slice(6, 9);
  const isAdmin = role === 'ADM';
  const maxDigits = isAdmin ? 3 : 4;
  return `${clean.slice(0,3)}-${clean.slice(3,6)}-${clean.slice(6,9)}-${clean.slice(9, 9 + maxDigits)}`;
};

const ROLE_INFO: any = {
  admin:   {label: 'Admin',   color: theme.colors.roleAdmin},
  teacher: {label: 'Teacher', color: theme.colors.roleTeacher},
  student: {label: 'Student', color: theme.colors.roleStudent},
  parent:  {label: 'Parent',  color: theme.colors.roleParent},
};

function RoleIcon({role, size, color}: {role: string, size: number, color: string}) {
  if (role === 'admin') return <ShieldCheckIcon size={size} color={color} />;
  if (role === 'teacher') return <AcademicCapIcon size={size} color={color} />;
  if (role === 'student') return <UserIcon size={size} color={color} />;
  if (role === 'parent') return <UsersIcon size={size} color={color} />;
  return null;
}

// One-time permission prompt, shown just before a password is written to this
// device for the first time. Wrapped in a promise so the login flow can wait
// for an answer instead of navigating away from under the dialog.
const askPermissionToRemember = (): Promise<boolean> =>
  new Promise(resolve => {
    Alert.alert(
      'Save Login Details?',
      'Would you like this device to remember your ID and password for faster login next time?\n\n' +
        'Only choose yes on a phone that is yours — on a shared or school device, anyone who opens the app would be able to sign in as you.',
      [
        {text: 'No', style: 'cancel', onPress: () => resolve(false)},
        {text: 'Yes, Remember Me', onPress: () => resolve(true)},
      ],
      // A tap outside the dialog (Android) has to settle the promise too,
      // otherwise the login would sit forever behind an await that never
      // resolves and the spinner would never stop.
      {cancelable: false, onDismiss: () => resolve(false)},
    );
  });

// Store a login that has just been proven to work — asking permission the first
// time, and only the first time. Once the device has been asked, ticking the
// checkbox is itself the answer and there is nothing left to prompt about.
const persistCredentials = async (loginId: string, loginPass: string) => {
  if (await hasAskedToRemember()) {
    await saveCredentials(loginId, loginPass);
    return;
  }
  const agreed = await askPermissionToRemember();
  await markAskedToRemember();
  if (agreed) {
    await saveCredentials(loginId, loginPass);
  } else {
    // Declining also unticks the box for next time, so the screen stops
    // implying the password is being kept when it is not.
    await clearCredentials();
  }
};

function LoginScreen({navigation}: any) {
  const [id, setId] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  // Blocks the form until AsyncStorage has been read, so the fields never
  // flash empty and then fill themselves in under the user's fingers.
  const [restoring, setRestoring] = useState(true);
  // Whose login is currently pre-filled, if any. Drives the "Forget saved
  // login" link — there is no point offering to forget nothing.
  const [savedId, setSavedId] = useState('');

  const detectedRole = detectRole(id);

  // Pre-fill from the last remembered login. Deliberately a pre-fill and not an
  // auto-submit: the user still taps Sign In, which keeps a shared device one
  // tap away from being handed to the wrong person.
  useEffect(() => {
    let alive = true;
    loadCredentials()
      .then(saved => {
        if (!alive) return;
        setRemember(saved.remember);
        if (saved.remember && saved.id) {
          setId(saved.id);
          setPass(saved.pass);
          setSavedId(saved.id);
        }
      })
      .finally(() => {
        if (alive) setRestoring(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Shared-device escape hatch: clear someone else's saved login without
  // having to sign in as them first. School office phones and family handsets
  // get passed around, and the person holding it may not be the one stored.
  const handleForgetSaved = () => {
    Alert.alert(
      'Forget Saved Login?',
      `This device will stop filling in ${savedId} automatically. Signing in again will just mean typing the ID and password.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Forget It',
          style: 'destructive',
          onPress: async () => {
            await forgetCredentials();
            setId('');
            setPass('');
            setSavedId('');
            setError('');
          },
        },
      ],
    );
  };

  const handleLogin = async () => {
    if (!id || !pass) {
      setError('Please enter your ID and password');
      return;
    }
    if (!detectedRole) {
      setError('Invalid ID. Please check and try again.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Email convention: full lowercased ID + domain.
      // Works for every role — e.g. TST-001-PAR-0001 → tst-001-par-0001@quantaip.edu.pk
      const email = `${id.toLowerCase()}@quantaip.edu.pk`;
      console.log('🔐 QUANTAIP Login →', {id, role: detectedRole, email});
      await auth().signInWithEmailAndPassword(email, pass);
      // Only ever store credentials that have just been proven to work.
      if (remember) {
        await persistCredentials(id, pass);
      } else {
        await clearCredentials();
      }
      const target =
        detectedRole === 'admin' ? 'Admin' :
        detectedRole === 'teacher' ? 'Teacher' :
        detectedRole === 'student' ? 'Student' : 'Parent';
      setId('');
      setPass('');
      navigation.reset({index: 0, routes: [{name: target}]});
    } catch (e: any) {
      console.log('❌ QUANTAIP Login failed →', e?.code, e?.message);
      setError('Invalid ID or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.navy} />

      {/* NAVBAR */}
      <View style={styles.navbar}>
        <Text style={styles.brand}>
          QUANT<Text style={styles.brandAccent}>AIP</Text>
        </Text>
        <Text style={styles.navSub}>EDUCATION OS</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.lockIcon}>
            <LockClosedIcon size={28} color="#B8960A" />
          </View>
          <Text style={styles.headerEye}>SECURE LOGIN</Text>
          <Text style={styles.headerTitle}>
            Welcome <Text style={styles.headerAccent}>Back</Text>
          </Text>
          <Text style={styles.headerSub}>Enter your ID to sign in</Text>
        </View>

        {/* ROLE DETECTED BADGE */}
        {detectedRole ? (
          <View style={[styles.roleBadge, {
            borderColor: ROLE_INFO[detectedRole].color,
            backgroundColor: ROLE_INFO[detectedRole].color + '18',
          }]}>
            <RoleIcon role={detectedRole} size={20} color={ROLE_INFO[detectedRole].color} />
            <Text style={[styles.roleBadgeTxt, {color: ROLE_INFO[detectedRole].color}]}>
              {ROLE_INFO[detectedRole].label} account detected
            </Text>
          </View>
        ) : id.length > 3 ? (
          <View style={styles.roleBadgeInvalid}>
            <ExclamationCircleIcon size={16} color={theme.colors.error} />
            <Text style={styles.roleBadgeInvalidTxt}> Invalid ID format</Text>
          </View>
        ) : null}

        {/* LOGIN FORM */}
        <View style={styles.card}>

          {/* ID Field */}
          <Text style={styles.fieldLabel}>YOUR ID</Text>
          <View style={styles.inputWrap}>
            <UserIcon size={18} color="#B8960A" />
            <TextInput
              style={styles.input}
              placeholder="e.g. GHS-001-STU-0001"
              placeholderTextColor={theme.colors.textPlaceholder}
              value={id}
              onChangeText={(text) => setId(formatId(text))}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              keyboardType="visible-password"
              spellCheck={false}
            />
          </View>

          {/* Password Field */}
          <Text style={[styles.fieldLabel, {marginTop: 14}]}>PASSWORD</Text>
          <View style={styles.inputWrap}>
            <LockClosedIcon size={18} color="#B8960A" />
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor={theme.colors.textPlaceholder}
              value={pass}
              onChangeText={setPass}
              secureTextEntry={!showPass}
              autoCorrect={false}
              autoComplete="off"
            />
            <TouchableOpacity
              onPress={() => setShowPass(!showPass)}
              style={styles.eyeBtn}>
              {showPass
                ? <EyeSlashIcon size={20} color={theme.colors.textMuted} />
                : <EyeIcon size={20} color={theme.colors.textMuted} />}
            </TouchableOpacity>
          </View>

          {/* Remember me — on by default; the hint spells out the trade-off
              so a school device gets it switched off knowingly. */}
          <TouchableOpacity
            style={styles.rememberRow}
            onPress={() => setRemember(!remember)}
            activeOpacity={0.7}>
            <View style={[styles.checkbox, remember && styles.checkboxOn]}>
              {remember ? <CheckIcon size={14} color="#D4AF37" /> : null}
            </View>
            <View style={styles.rememberTxtWrap}>
              <Text style={styles.rememberTxt}>Remember me on this device</Text>
              <Text style={styles.rememberHint}>
                {remember
                  ? 'Your ID and password will be filled in next time'
                  : 'Turn off on shared or school devices'}
              </Text>
            </View>
          </TouchableOpacity>

          {error ? (
            <View style={styles.errorWrap}>
              <ExclamationCircleIcon size={14} color={theme.colors.error} />
              <Text style={styles.errorTxt}> {error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.loginBtn,
              (!detectedRole || loading || restoring) && styles.loginBtnDisabled,
            ]}
            onPress={handleLogin}
            disabled={!detectedRole || loading || restoring}
            activeOpacity={0.8}>
            {loading ? (
              <ActivityIndicator color="#D4AF37" />
            ) : (
              <View style={styles.loginBtnInner}>
                <Text style={styles.loginBtnTxt}>
                  {detectedRole ? 'Sign In' : 'Enter your ID first'}
                </Text>
                {detectedRole && <ArrowRightIcon size={18} color="#D4AF37" />}
              </View>
            )}
          </TouchableOpacity>

          {/* Only offered when there is actually a saved login to clear. */}
          {savedId ? (
            <TouchableOpacity
              style={styles.forgetRow}
              onPress={handleForgetSaved}
              activeOpacity={0.7}>
              <TrashIcon size={13} color={theme.colors.textMuted} />
              <Text style={styles.forgetTxt}>Forget saved login</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* FOOTER */}
        <View style={styles.footerRow}>
          <ShieldCheckIcon size={13} color={theme.colors.textMuted} />
          <Text style={styles.footerTxt}> Secured by QUANTAIP · quantaip.org</Text>
        </View>

      </ScrollView>
    </View>
  );
}

export default function App() {
  // Downloads any published JS-only update in the background; it takes effect
  // on the next cold start so nobody loses a half-entered form. See
  // services/otaUpdates.ts.
  useOtaUpdates();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Admin" component={AdminScreen} />
        <Stack.Screen name="Teacher" component={TeacherScreen} />
        <Stack.Screen name="Student" component={StudentScreen} />
        <Stack.Screen name="Parent" component={ParentScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.colors.cream},
  navbar: {
    backgroundColor: theme.colors.navy,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {fontSize: 20, fontWeight: '700', color: theme.colors.textOnDark, letterSpacing: 2},
  brandAccent: {color: '#B8960A'},
  navSub: {fontSize: 9, letterSpacing: 3, color: theme.colors.textOnDarkMuted},
  scroll: {padding: 16, paddingBottom: 40},
  header: {alignItems: 'center', marginVertical: 24},
  lockIcon: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: theme.colors.goldLight, borderWidth: 1, borderColor: theme.colors.goldBorder,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  headerEye: {fontSize: 10, letterSpacing: 4, color: '#B8960A', fontWeight: '600', marginBottom: 8},
  headerTitle: {fontSize: 32, fontWeight: '700', color: theme.colors.navy, marginBottom: 6},
  headerAccent: {color: '#B8960A'},
  headerSub: {fontSize: 14, color: theme.colors.textMuted},
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 12, borderWidth: 1.5, marginBottom: 12,
  },
  roleBadgeTxt: {fontSize: 14, fontWeight: '700'},
  roleBadgeInvalid: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.errorBg, borderWidth: 1, borderColor: theme.colors.errorBorder,
    borderRadius: 12, padding: 12, marginBottom: 12,
  },
  roleBadgeInvalidTxt: {fontSize: 13, color: theme.colors.error, fontWeight: '600'},
  card: {
    backgroundColor: theme.colors.white, borderRadius: 16, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: theme.colors.warmBorder,
  },
  fieldLabel: {fontSize: 11, fontWeight: '600', color: '#B8960A', letterSpacing: 2, marginBottom: 10},
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.colors.white, borderWidth: 1.5, borderColor: theme.colors.warmBorder,
    borderRadius: 10, paddingHorizontal: 12,
  },
  input: {flex: 1, padding: 13, fontSize: 14, color: theme.colors.navy, fontWeight: '500'},
  eyeBtn: {padding: 4},
  rememberRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16},
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: theme.colors.warmBorder,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.white,
  },
  checkboxOn: {backgroundColor: theme.colors.navy, borderColor: theme.colors.navy},
  forgetRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 14, paddingVertical: 6,
  },
  forgetTxt: {fontSize: 12, color: theme.colors.textMuted, textDecorationLine: 'underline'},
  rememberTxtWrap: {flex: 1},
  rememberTxt: {fontSize: 13, fontWeight: '600', color: theme.colors.navy},
  rememberHint: {fontSize: 11, color: theme.colors.textMuted, marginTop: 2},
  errorWrap: {flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 4},
  errorTxt: {fontSize: 13, color: theme.colors.error, fontWeight: '500'},
  loginBtn: {
    borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 16,
    backgroundColor: theme.colors.navy,
  },
  loginBtnDisabled: {backgroundColor: '#9ca3af'},
  loginBtnInner: {flexDirection: 'row', alignItems: 'center', gap: 8},
  loginBtnTxt: {color: '#D4AF37', fontSize: 15, fontWeight: '700'},
  footerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 4, marginBottom: 10,
  },
  footerTxt: {fontSize: 11, color: theme.colors.textMuted, fontWeight: '500'},
});