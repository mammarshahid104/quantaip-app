import auth from '@react-native-firebase/auth';
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
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
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

const ROLE_INFO: any = {
  admin:   {label: 'Admin',   icon: '⚙',        color: '#7c3aed'},
  teacher: {label: 'Teacher', icon: '📚',        color: '#0891b2'},
  student: {label: 'Student', icon: '🎓',        color: '#16a34a'},
  parent:  {label: 'Parent',  icon: '👨‍👩‍👧', color: '#ea580c'},
};

function LoginScreen({navigation}: any) {
  const [id, setId] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

      if (detectedRole === 'admin') navigation.navigate('Admin');
      else if (detectedRole === 'teacher') navigation.navigate('Teacher');
      else if (detectedRole === 'student') navigation.navigate('Student');
      else if (detectedRole === 'parent') navigation.navigate('Parent');

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
            <Text style={styles.roleBadgeIcon}>{ROLE_INFO[detectedRole].icon}</Text>
            <Text style={[styles.roleBadgeTxt, {color: ROLE_INFO[detectedRole].color}]}>
              {ROLE_INFO[detectedRole].label} account detected
            </Text>
          </View>
        ) : id.length > 3 ? (
          <View style={styles.roleBadgeInvalid}>
            <Text style={styles.roleBadgeInvalidTxt}>⚠ Invalid ID format</Text>
          </View>
        ) : null}

        {/* LOGIN FORM */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>YOUR ID</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your ID"
            placeholderTextColor="#c4b5fd"
            value={id}
            onChangeText={setId}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.fieldLabel, {marginTop: 14}]}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#c4b5fd"
            value={pass}
            onChangeText={setPass}
            secureTextEntry
          />

          {error ? (
            <Text style={styles.errorTxt}>{error}</Text>
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
              <Text style={styles.loginBtnTxt}>
                {detectedRole
                  ? `Login as ${ROLE_INFO[detectedRole].label} →`
                  : 'Enter your ID first'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* FOOTER */}
        <View style={styles.footerRow}>
          <Text style={styles.footerLock}>🔒</Text>
          <Text style={styles.footerTxt}>Secured by QUANTAIP · quantaip.org</Text>
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
  headerEye: {
    fontSize: 10,
    letterSpacing: 4,
    color: '#7c3aed',
    fontWeight: '600',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1e1b4b',
    marginBottom: 6,
  },
  headerAccent: {color: '#7c3aed'},
  headerSub: {fontSize: 14, color: '#6b7280'},
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  roleBadgeIcon: {fontSize: 18},
  roleBadgeTxt: {fontSize: 14, fontWeight: '700'},
  roleBadgeInvalid: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  roleBadgeInvalidTxt: {fontSize: 13, color: '#ef4444', fontWeight: '600'},
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ede9fe',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7c3aed',
    letterSpacing: 2,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#f5f3ff',
    borderWidth: 1.5,
    borderColor: '#ede9fe',
    borderRadius: 10,
    padding: 13,
    fontSize: 14,
    color: '#1e1b4b',
    fontWeight: '500',
  },
  errorTxt: {
    fontSize: 13,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
    fontWeight: '500',
  },
  loginBtn: {
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 16,
  },
  loginBtnDisabled: {backgroundColor: '#c4b5fd'},
  loginBtnTxt: {color: '#ffffff', fontSize: 15, fontWeight: '700'},
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },
  footerLock: {fontSize: 12},
  footerTxt: {fontSize: 11, color: '#a78bfa', fontWeight: '500'},
});