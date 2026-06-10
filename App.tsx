import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
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
} from 'react-native-heroicons/outline';
import AdminScreen from './screens/AdminScreen';
import TeacherScreen from './screens/TeacherScreen';
import StudentScreen from './screens/StudentScreen';
import ParentScreen from './screens/ParentScreen';

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
  admin:   {label: 'Admin',   color: '#4f46e5'},
  teacher: {label: 'Teacher', color: '#059669'},
  student: {label: 'Student', color: '#0284c7'},
  parent:  {label: 'Parent',  color: '#9333ea'},
};

function RoleIcon({role, size, color}: {role: string, size: number, color: string}) {
  if (role === 'admin') return <ShieldCheckIcon size={size} color={color} />;
  if (role === 'teacher') return <AcademicCapIcon size={size} color={color} />;
  if (role === 'student') return <UserIcon size={size} color={color} />;
  if (role === 'parent') return <UsersIcon size={size} color={color} />;
  return null;
}

function LoginScreen({navigation}: any) {
  const [id, setId] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const detectedRole = detectRole(id);

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
      const email = `${id.toLowerCase()}@quantaip.edu.pk`;
      await auth().signInWithEmailAndPassword(email, pass);
      const target =
        detectedRole === 'admin' ? 'Admin' :
        detectedRole === 'teacher' ? 'Teacher' :
        detectedRole === 'student' ? 'Student' : 'Parent';
      setId('');
      setPass('');
      navigation.reset({index: 0, routes: [{name: target}]});
    } catch (e: any) {
      setError('Invalid ID or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1e1b4b" />

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
            <LockClosedIcon size={28} color="#7c3aed" />
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
            backgroundColor: ROLE_INFO[detectedRole].color + '15',
          }]}>
            <RoleIcon role={detectedRole} size={20} color={ROLE_INFO[detectedRole].color} />
            <Text style={[styles.roleBadgeTxt, {color: ROLE_INFO[detectedRole].color}]}>
              {ROLE_INFO[detectedRole].label} account detected
            </Text>
          </View>
        ) : id.length > 3 ? (
          <View style={styles.roleBadgeInvalid}>
            <ExclamationCircleIcon size={16} color="#ef4444" />
            <Text style={styles.roleBadgeInvalidTxt}> Invalid ID format</Text>
          </View>
        ) : null}

        {/* LOGIN FORM */}
        <View style={styles.card}>

          {/* ID Field */}
          <Text style={styles.fieldLabel}>YOUR ID</Text>
          <View style={styles.inputWrap}>
            <UserIcon size={18} color="#c4b5fd" />
            <TextInput
              style={styles.input}
              placeholder="e.g. GHS-001-STU-0001"
              placeholderTextColor="#c4b5fd"
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
            <LockClosedIcon size={18} color="#c4b5fd" />
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#c4b5fd"
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
                ? <EyeSlashIcon size={20} color="#9ca3af" />
                : <EyeIcon size={20} color="#9ca3af" />}
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorWrap}>
              <ExclamationCircleIcon size={14} color="#ef4444" />
              <Text style={styles.errorTxt}> {error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.loginBtn,
              (!detectedRole || loading) && styles.loginBtnDisabled,
              detectedRole && {backgroundColor: ROLE_INFO[detectedRole].color},
            ]}
            onPress={handleLogin}
            disabled={!detectedRole || loading}
            activeOpacity={0.8}>
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <View style={styles.loginBtnInner}>
                <Text style={styles.loginBtnTxt}>
                  {detectedRole
                    ? `Login as ${ROLE_INFO[detectedRole].label}`
                    : 'Enter your ID first'}
                </Text>
                {detectedRole && <ArrowRightIcon size={18} color="#ffffff" />}
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* FOOTER */}
        <View style={styles.footerRow}>
          <ShieldCheckIcon size={13} color="#a78bfa" />
          <Text style={styles.footerTxt}> Secured by QUANTAIP · quantaip.org</Text>
        </View>

      </ScrollView>
    </View>
  );
}

export default function App() {
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
  root: {flex: 1, backgroundColor: '#faf5ff'},
  navbar: {
    backgroundColor: '#1e1b4b',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {fontSize: 20, fontWeight: '700', color: '#ffffff', letterSpacing: 2},
  brandAccent: {color: '#a78bfa'},
  navSub: {fontSize: 9, letterSpacing: 3, color: 'rgba(255,255,255,0.5)'},
  scroll: {padding: 16, paddingBottom: 40},
  header: {alignItems: 'center', marginVertical: 24},
  lockIcon: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#ede9fe',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  headerEye: {fontSize: 10, letterSpacing: 4, color: '#7c3aed', fontWeight: '600', marginBottom: 8},
  headerTitle: {fontSize: 32, fontWeight: '700', color: '#1e1b4b', marginBottom: 6},
  headerAccent: {color: '#7c3aed'},
  headerSub: {fontSize: 14, color: '#6b7280'},
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 12, borderWidth: 1.5, marginBottom: 12,
  },
  roleBadgeTxt: {fontSize: 14, fontWeight: '700'},
  roleBadgeInvalid: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
    borderRadius: 12, padding: 12, marginBottom: 12,
  },
  roleBadgeInvalidTxt: {fontSize: 13, color: '#ef4444', fontWeight: '600'},
  card: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: '#ede9fe',
  },
  fieldLabel: {fontSize: 11, fontWeight: '600', color: '#7c3aed', letterSpacing: 2, marginBottom: 10},
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f5f3ff', borderWidth: 1.5, borderColor: '#ede9fe',
    borderRadius: 10, paddingHorizontal: 12,
  },
  input: {flex: 1, padding: 13, fontSize: 14, color: '#1e1b4b', fontWeight: '500'},
  eyeBtn: {padding: 4},
  errorWrap: {flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 4},
  errorTxt: {fontSize: 13, color: '#ef4444', fontWeight: '500'},
  loginBtn: {borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 16},
  loginBtnDisabled: {backgroundColor: '#c4b5fd'},
  loginBtnInner: {flexDirection: 'row', alignItems: 'center', gap: 8},
  loginBtnTxt: {color: '#ffffff', fontSize: 15, fontWeight: '700'},
  footerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 4, marginBottom: 10,
  },
  footerTxt: {fontSize: 11, color: '#a78bfa', fontWeight: '500'},
});